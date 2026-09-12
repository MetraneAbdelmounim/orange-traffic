export interface Member {
  _id: string;
  username: string;
  isAdmin: boolean;
  actif: boolean;
  mustChangePassword: boolean;
  projects: Array<{ _id: string; nom: string }>;
  createdAt?: string;
}
