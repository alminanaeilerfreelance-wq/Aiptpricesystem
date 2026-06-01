import mongoose, { Document, Model } from 'mongoose';
import type { ModulePermission } from '@/lib/permissions';

export interface IRole extends Document {
  name: string;
  description?: string;
  permissions: string[];
  modulePermissions: ModulePermission[];
  createdAt: Date;
  updatedAt: Date;
}

const modulePermissionSchema = new mongoose.Schema(
  {
    module: { type: String, required: true, trim: true },
    actions: [{ type: String, required: true, trim: true }],
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    permissions: [{ type: String, trim: true }],
    modulePermissions: { type: [modulePermissionSchema], default: [] },
  },
  { timestamps: true }
);

const Role: Model<IRole> =
  (mongoose.models.Role as Model<IRole>) || mongoose.model<IRole>('Role', roleSchema);

export default Role;
