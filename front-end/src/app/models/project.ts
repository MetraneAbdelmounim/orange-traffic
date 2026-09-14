export interface Project {
  _id: string;
  nom: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Populated by GET /api/projects (aggregation); absent from other endpoints. */
  controllerCount?: number;
  alarmCount?: number;
  offlineCount?: number;
  maintenanceCount?: number;
}
