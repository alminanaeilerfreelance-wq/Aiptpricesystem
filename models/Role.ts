import mongoose, { Document, Model } from 'mongoose';

export interface IRole extends Document {
  name: string;
  description?: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new mongoose.Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    permissions: [
      {
        type: String,
        enum: [
          'view_dashboard',
          'manage_users',
          'manage_roles',
          'create_quotation',
          'view_quotation',
          'edit_quotation',
          'approve_quotation',
          'delete_quotation',
          'view_reports',
          'manage_clients',
          'manage_services',
          'manage_settings',
          'manage_departments',
          'manage_countries',
          'manage_pricing',
          'export_data',
        ],
      },
    ],
  },
  { timestamps: true }
);

const Role: Model<IRole> =
  (mongoose.models.Role as Model<IRole>) || mongoose.model<IRole>('Role', roleSchema);

export default Role;
