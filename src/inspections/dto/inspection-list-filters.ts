import {
  InspectionScope,
  InspectionStatus,
  ModuleType,
} from '../../common/enums';

export type InspectionListFilters = {
  periodFrom?: string;
  periodTo?: string;
  module?: ModuleType;
  inspectionScope?: InspectionScope;
  teamId?: string;
  createdByUserId?: string;
  contractId?: string;
  status?: InspectionStatus;
  osNumber?: string;
  investmentWorkId?: string;
  executionFrom?: string;
  executionTo?: string;
  inspectionFrom?: string;
  inspectionTo?: string;
  service?: string;
};
