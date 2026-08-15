import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { existsSync } from 'fs';
import {
  getLocalStorageRoot,
  resolveSafeLocalPath,
} from '../storage/adapters/local-asset-storage.adapter';

@Controller('files')
export class FilesController {
  @Get('*')
  serve(@Req() req: Request, @Res() res: Response) {
    const relativeKey = decodeURIComponent(
      req.path.replace(/^\/files\/?/, ''),
    ).replace(/^\/+/, '');

    const notFound = () => res.status(404).json({ message: 'File not found' });

    if (!relativeKey) {
      return notFound();
    }

    let fullPath: string;
    try {
      fullPath = resolveSafeLocalPath(getLocalStorageRoot(), relativeKey);
    } catch {
      return notFound();
    }

    if (!existsSync(fullPath)) {
      return notFound();
    }

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.sendFile(fullPath);
  }
}
