import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection } from '../entities';
import { ChecklistAnswer } from '../common/enums';
const PDFDocument = require('pdfkit');
import { FilesService } from '../files/files.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PdfService {
  constructor(
    @InjectRepository(Inspection)
    private inspectionsRepository: Repository<Inspection>,
    private filesService: FilesService,
  ) {}

  async generatePdf(inspectionId: string): Promise<Buffer> {
    const inspection = await this.inspectionsRepository.findOne({
      where: { id: inspectionId },
      relations: [
        'checklist',
        'checklist.items',
        'team',
        'createdBy',
        'items',
        'items.checklistItem',
        'items.evidences',
        'evidences',
        'signatures',
        'collaborators',
      ],
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria não encontrada');
    }

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {});

    // Cabeçalho
    doc.fontSize(20).text('Relatório de Vistoria', { align: 'center' });
    doc.moveDown();

    // Dados da Vistoria
    doc.fontSize(14).text('Dados da Vistoria', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`ID: ${inspection.id}`);
    doc.text(`Módulo: ${inspection.module}`);
    doc.text(`Checklist: ${inspection.checklist?.name || 'N/A'}`);
    doc.text(`Equipe: ${inspection.team?.name || 'N/A'}`);
    doc.text(`Criado por: ${inspection.createdBy?.name || 'N/A'}`);
    doc.text(`Data de criação: ${inspection.createdAt.toLocaleDateString('pt-BR')}`);
    if (inspection.finalizedAt) {
      doc.text(`Data de finalização: ${inspection.finalizedAt.toLocaleDateString('pt-BR')}`);
    }
    doc.text(`Status: ${inspection.status}`);
    doc.text(`Percentual de Conformidade: ${inspection.scorePercent?.toFixed(2) || '0.00'}%`);
    doc.moveDown();

    if (inspection.serviceDescription) {
      doc.text(`Descrição do Serviço: ${inspection.serviceDescription}`);
      doc.moveDown();
    }

    if (inspection.locationDescription) {
      doc.text(`Descrição da Localização: ${inspection.locationDescription}`);
      doc.moveDown();
    }

    // Tabela do Checklist
    doc.fontSize(14).text('Itens do Checklist', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const itemHeight = 20;
    let currentY = tableTop;

    // Cabeçalho da tabela
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Item', 50, currentY);
    doc.text('Resposta', 300, currentY);
    doc.text('Observações', 400, currentY);
    currentY += itemHeight;

    doc.font('Helvetica').fontSize(9);
    doc.strokeColor('#000000');

    // Itens
    const sortedItems = inspection.items
      ? [...inspection.items].sort(
          (a, b) => (a.checklistItem?.order || 0) - (b.checklistItem?.order || 0),
        )
      : [];

    for (const item of sortedItems) {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      const answerText =
        item.answer === ChecklistAnswer.CONFORME
          ? 'Conforme'
          : item.answer === ChecklistAnswer.NAO_CONFORME
            ? 'Não Conforme'
            : item.answer === ChecklistAnswer.NAO_APLICAVEL
              ? 'Não Aplicável'
              : 'Não avaliado';

      doc.text(item.checklistItem?.title || 'N/A', 50, currentY, {
        width: 240,
        ellipsis: true,
      });
      doc.text(answerText, 300, currentY, { width: 90 });
      doc.text(item.notes || '-', 400, currentY, {
        width: 150,
        ellipsis: true,
      });

      if (item.evidences && item.evidences.length > 0) {
        doc.fontSize(8).fillColor('blue');
        doc.text(`(${item.evidences.length} evidência(s))`, 50, currentY + 12);
        doc.fontSize(9).fillColor('black');
      }

      currentY += itemHeight + 5;
    }

    // Assinatura
    if (inspection.signatures && inspection.signatures.length > 0) {
      doc.addPage();
      doc.fontSize(14).text('Assinatura', { underline: true });
      doc.moveDown();
      const signature = inspection.signatures[0];
      doc.text(`Assinado por: ${signature.signerName}`);
      doc.text(`Cargo: ${signature.signerRoleLabel}`);
      doc.text(`Data: ${signature.signedAt.toLocaleDateString('pt-BR')}`);
      doc.moveDown();

      try {
        const signatureImage = await this.filesService.getFile(signature.imagePath);
        doc.image(signatureImage, {
          fit: [200, 100],
          align: 'left',
        });
      } catch (error) {
        doc.text('(Imagem de assinatura não disponível)');
      }
    }

    // Evidências gerais
    if (inspection.evidences && inspection.evidences.length > 0) {
      const generalEvidences = inspection.evidences.filter(
        (e) => !e.inspectionItemId,
      );
      if (generalEvidences.length > 0) {
        doc.addPage();
        doc.fontSize(14).text('Evidências Gerais', { underline: true });
        doc.moveDown();
        doc.fontSize(10);
        generalEvidences.forEach((evidence) => {
          doc.text(`- ${evidence.fileName} (${(evidence.size / 1024).toFixed(2)} KB)`);
        });
      }
    }

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }
}
