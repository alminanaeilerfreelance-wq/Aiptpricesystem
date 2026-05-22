import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'aipt_db';

if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI not set in .env.local');
  process.exit(1);
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  { name: String, email: { type: String, unique: true }, password: String, role: String, isActive: { type: Boolean, default: true } },
  { timestamps: true }
);
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const serviceSchema = new mongoose.Schema(
  { name: String, description: String, category: String, basePrice: Number, isActive: { type: Boolean, default: true } },
  { timestamps: true }
);

const countrySchema = new mongoose.Schema(
  { name: String, abbreviation: String, flagCode: String, isActive: { type: Boolean, default: true } },
  { timestamps: true }
);

const procedureSchema = new mongoose.Schema(
  { name: String, description: String, serviceCategory: String, isActive: { type: Boolean, default: true }, sortOrder: { type: Number, default: 0 } },
  { timestamps: true }
);

const clientTypeSchema = new mongoose.Schema(
  { name: String, description: String, multiplier: { type: Number, default: 1 }, isActive: { type: Boolean, default: true } },
  { timestamps: true }
);

const pricingRuleSchema = new mongoose.Schema(
  { serviceCategory: String, procedureName: String, countryName: String, countryAbbreviation: String, officialFee: Number, attorneyFee: Number, classFee: Number, isActive: { type: Boolean, default: true } },
  { timestamps: true }
);

const clientSchema = new mongoose.Schema(
  { name: String, email: String, phone: String, country: String, address: String, city: String, type: String, isActive: { type: Boolean, default: true } },
  { timestamps: true }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNo: { type: String, unique: true },
    clientId: mongoose.Schema.Types.ObjectId,
    clientName: String, clientEmail: String, clientType: String,
    service: String, procedure: String, country: String,
    numberOfClasses: Number,
    fees: { governmentFee: Number, serviceFee: Number, classFee: Number, procedureFee: Number },
    multiplier: Number, subtotal: Number, total: Number,
    currency: { type: String, default: 'SAR' },
    status: { type: String, default: 'Draft' },
    validDays: { type: Number, default: 30 },
    notes: String,
    createdBy: mongoose.Schema.Types.ObjectId,
    approvedBy: mongoose.Schema.Types.ObjectId,
    approvalDate: Date,
  },
  { timestamps: true }
);

const settingsSchema = new mongoose.Schema(
  { companyName: String, companyEmail: String, companyPhone: String, companyAddress: String, currency: String, defaultValidDays: Number, termsAndConditions: String },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);
const Country = mongoose.models.Country || mongoose.model('Country', countrySchema);
const Procedure = mongoose.models.Procedure || mongoose.model('Procedure', procedureSchema);
const ClientType = mongoose.models.ClientType || mongoose.model('ClientType', clientTypeSchema);
const PricingRule = mongoose.models.PricingRule || mongoose.model('PricingRule', pricingRuleSchema);
const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);
const Quotation = mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

// ─── Seed Data ───────────────────────────────────────────────────────────────

const USERS = [
  { name: 'Demo Admin', email: 'admin@demo.com', password: 'demo1234', role: 'admin' },
  { name: 'Demo Manager', email: 'manager@demo.com', password: 'demo1234', role: 'manager' },
  { name: 'Demo User', email: 'user@demo.com', password: 'demo1234', role: 'user' },
];

const SERVICES = [
  { name: 'Trademark Registration', category: 'Trademark', basePrice: 2500, description: 'Register a new trademark in the target country' },
  { name: 'Patent Filing', category: 'Patent', basePrice: 5000, description: 'File a new patent application' },
  { name: 'Design Registration', category: 'Design', basePrice: 1800, description: 'Register an industrial design' },
  { name: 'Copyright Registration', category: 'Copyright', basePrice: 1200, description: 'Register copyright for creative works' },
  { name: 'Trademark Litigation', category: 'Litigation', basePrice: 8000, description: 'Legal representation in trademark disputes' },
];

const COUNTRIES = [
  { name: 'Saudi Arabia', abbreviation: 'SA', flagCode: 'sa' },
  { name: 'United Arab Emirates', abbreviation: 'AE', flagCode: 'ae' },
  { name: 'United States', abbreviation: 'US', flagCode: 'us' },
  { name: 'United Kingdom', abbreviation: 'GB', flagCode: 'gb' },
  { name: 'Germany', abbreviation: 'DE', flagCode: 'de' },
  { name: 'France', abbreviation: 'FR', flagCode: 'fr' },
  { name: 'China', abbreviation: 'CN', flagCode: 'cn' },
  { name: 'Japan', abbreviation: 'JP', flagCode: 'jp' },
  { name: 'Egypt', abbreviation: 'EG', flagCode: 'eg' },
  { name: 'Kuwait', abbreviation: 'KW', flagCode: 'kw' },
  { name: 'Qatar', abbreviation: 'QA', flagCode: 'qa' },
  { name: 'Bahrain', abbreviation: 'BH', flagCode: 'bh' },
];

const PROCEDURES = [
  // Trademark
  { name: 'Filing (New Application)', serviceCategory: 'Trademark', sortOrder: 1, description: 'Initial trademark filing' },
  { name: 'Prosecution', serviceCategory: 'Trademark', sortOrder: 2, description: 'Respond to office actions' },
  { name: 'Renewal', serviceCategory: 'Trademark', sortOrder: 3, description: 'Renew existing trademark registration' },
  { name: 'Opposition', serviceCategory: 'Trademark', sortOrder: 4, description: 'File or respond to trademark opposition' },
  // Patent
  { name: 'Filing (New Application)', serviceCategory: 'Patent', sortOrder: 1, description: 'Initial patent application' },
  { name: 'Prosecution', serviceCategory: 'Patent', sortOrder: 2, description: 'Respond to examination reports' },
  { name: 'Renewal / Annuity', serviceCategory: 'Patent', sortOrder: 3, description: 'Annual maintenance fees' },
  // Design
  { name: 'Filing (New Application)', serviceCategory: 'Design', sortOrder: 1, description: 'Initial design registration' },
  { name: 'Renewal', serviceCategory: 'Design', sortOrder: 2, description: 'Renew design registration' },
  // Litigation
  { name: 'Filing Lawsuit', serviceCategory: 'Litigation', sortOrder: 1, description: 'Initiate legal proceedings' },
  { name: 'Defense', serviceCategory: 'Litigation', sortOrder: 2, description: 'Defend against IP claims' },
];

const CLIENT_TYPES = [
  { name: 'Standard', description: 'Standard client rate', multiplier: 1.0 },
  { name: 'Preferred', description: 'Preferred client — 10% discount', multiplier: 0.9 },
  { name: 'VIP', description: 'VIP client — 20% discount', multiplier: 0.8 },
  { name: 'Government', description: 'Government entity', multiplier: 1.2 },
  { name: 'Startup', description: 'Startup / SME rate', multiplier: 0.85 },
];

const PRICING_RULES = [
  // Trademark — Filing
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 1500, attorneyFee: 2000, classFee: 300 },
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'United Arab Emirates', countryAbbreviation: 'AE', officialFee: 1800, attorneyFee: 2200, classFee: 350 },
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'United States', countryAbbreviation: 'US', officialFee: 2500, attorneyFee: 3000, classFee: 400 },
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'United Kingdom', countryAbbreviation: 'GB', officialFee: 2000, attorneyFee: 2500, classFee: 380 },
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'Germany', countryAbbreviation: 'DE', officialFee: 1900, attorneyFee: 2300, classFee: 360 },
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'China', countryAbbreviation: 'CN', officialFee: 1200, attorneyFee: 1800, classFee: 250 },
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'Egypt', countryAbbreviation: 'EG', officialFee: 800, attorneyFee: 1200, classFee: 150 },
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'Kuwait', countryAbbreviation: 'KW', officialFee: 1400, attorneyFee: 1900, classFee: 280 },
  // Trademark — Renewal
  { serviceCategory: 'Trademark', procedureName: 'Renewal', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 1200, attorneyFee: 1500, classFee: 250 },
  { serviceCategory: 'Trademark', procedureName: 'Renewal', countryName: 'United Arab Emirates', countryAbbreviation: 'AE', officialFee: 1400, attorneyFee: 1700, classFee: 280 },
  { serviceCategory: 'Trademark', procedureName: 'Renewal', countryName: 'United States', countryAbbreviation: 'US', officialFee: 1800, attorneyFee: 2200, classFee: 300 },
  // Patent — Filing
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 3000, attorneyFee: 4000, classFee: 0 },
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'United Arab Emirates', countryAbbreviation: 'AE', officialFee: 3500, attorneyFee: 4500, classFee: 0 },
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'United States', countryAbbreviation: 'US', officialFee: 5000, attorneyFee: 6000, classFee: 0 },
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'Germany', countryAbbreviation: 'DE', officialFee: 4000, attorneyFee: 5000, classFee: 0 },
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'China', countryAbbreviation: 'CN', officialFee: 2500, attorneyFee: 3500, classFee: 0 },
  // Design — Filing
  { serviceCategory: 'Design', procedureName: 'Filing (New Application)', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 1000, attorneyFee: 1500, classFee: 0 },
  { serviceCategory: 'Design', procedureName: 'Filing (New Application)', countryName: 'United Arab Emirates', countryAbbreviation: 'AE', officialFee: 1200, attorneyFee: 1700, classFee: 0 },
  { serviceCategory: 'Design', procedureName: 'Filing (New Application)', countryName: 'United States', countryAbbreviation: 'US', officialFee: 2000, attorneyFee: 2800, classFee: 0 },
];

const CLIENTS = [
  { name: 'Al Khaleej Trading Co.', email: 'info@alkhaleej.com', phone: '+966 11 234 5678', country: 'Saudi Arabia', city: 'Riyadh', type: 'Company' },
  { name: 'TechVision LLC', email: 'legal@techvision.ae', phone: '+971 4 567 8901', country: 'United Arab Emirates', city: 'Dubai', type: 'Company' },
  { name: 'Global Innovations Inc.', email: 'ip@globalinnovations.com', phone: '+1 212 555 0100', country: 'United States', city: 'New York', type: 'Company' },
  { name: 'Saudi Industrial Corp', email: 'trademarks@sic.sa', phone: '+966 13 444 5555', country: 'Saudi Arabia', city: 'Dammam', type: 'Company' },
  { name: 'Dr. Ahmed Al-Rashid', email: 'ahmed.rashid@gmail.com', phone: '+966 55 123 4567', country: 'Saudi Arabia', city: 'Jeddah', type: 'Individual' },
  { name: 'Kuwait Finance House', email: 'legal@kfh.com.kw', phone: '+965 2224 0000', country: 'Kuwait', city: 'Kuwait City', type: 'Company' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(emoji, msg) {
  console.log(`  ${emoji}  ${msg}`);
}

async function upsertMany(Model, docs, keyField = 'name') {
  let created = 0, skipped = 0;
  for (const doc of docs) {
    const exists = await Model.findOne({ [keyField]: doc[keyField] });
    if (exists) { skipped++; continue; }
    await Model.create(doc);
    created++;
  }
  return { created, skipped };
}

async function upsertUser(data) {
  const exists = await User.findOne({ email: data.email });
  if (exists) return { created: 0, skipped: 1 };
  const user = new User(data);
  await user.save();
  return { created: 1, skipped: 0 };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  IP Law Firm — Database Seed\n');

  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  log('✅', `Connected to MongoDB  (db: ${MONGODB_DB})`);

  // Users
  let totalCreated = 0, totalSkipped = 0;
  for (const u of USERS) {
    const r = await upsertUser(u);
    totalCreated += r.created; totalSkipped += r.skipped;
  }
  log('👤', `Users        created: ${totalCreated}  skipped: ${totalSkipped}`);

  // Services
  let r = await upsertMany(Service, SERVICES);
  log('⚙️ ', `Services     created: ${r.created}  skipped: ${r.skipped}`);

  // Countries
  r = await upsertMany(Country, COUNTRIES);
  log('🌍', `Countries    created: ${r.created}  skipped: ${r.skipped}`);

  // Procedures (key = name + serviceCategory)
  let pc = 0, ps = 0;
  for (const p of PROCEDURES) {
    const exists = await Procedure.findOne({ name: p.name, serviceCategory: p.serviceCategory });
    if (exists) { ps++; continue; }
    await Procedure.create(p);
    pc++;
  }
  log('📋', `Procedures   created: ${pc}  skipped: ${ps}`);

  // Client Types
  r = await upsertMany(ClientType, CLIENT_TYPES);
  log('🏷️ ', `Client Types created: ${r.created}  skipped: ${r.skipped}`);

  // Pricing Rules (key = serviceCategory + procedureName + countryName)
  let prc = 0, prs = 0;
  for (const rule of PRICING_RULES) {
    const exists = await PricingRule.findOne({
      serviceCategory: rule.serviceCategory,
      procedureName: rule.procedureName,
      countryName: rule.countryName,
    });
    if (exists) { prs++; continue; }
    await PricingRule.create(rule);
    prc++;
  }
  log('💰', `Pricing Rules created: ${prc}  skipped: ${prs}`);

  // Clients
  r = await upsertMany(Client, CLIENTS, 'email');
  log('🏢', `Clients      created: ${r.created}  skipped: ${r.skipped}`);

  // Settings
  const settingsExists = await Settings.findOne({});
  if (!settingsExists) {
    await Settings.create({
      companyName: 'IP Law Firm',
      companyEmail: 'info@iplawfirm.com',
      companyPhone: '+966 11 000 0000',
      companyAddress: 'King Fahd Road, Riyadh, Saudi Arabia',
      currency: 'SAR',
      defaultValidDays: 30,
      termsAndConditions: 'This quotation is valid for the specified number of days from the issue date. All fees are subject to applicable taxes.',
    });
    log('⚙️ ', `Settings     created: 1  skipped: 0`);
  } else {
    log('⚙️ ', `Settings     created: 0  skipped: 1`);
  }

  // Sample Quotations
  const adminUser = await User.findOne({ role: 'admin' });
  const allClients = await Client.find({ isActive: true });

  const sampleQuotations = [
    { clientName: 'Al Khaleej Trading Co.', clientEmail: 'info@alkhaleej.com', clientType: 'Standard', service: 'Trademark', procedure: 'Filing (New Application)', country: 'Saudi Arabia', numberOfClasses: 3, fees: { governmentFee: 1500, serviceFee: 2000, classFee: 300, procedureFee: 0 }, multiplier: 1.0, currency: 'SAR', status: 'Approved', validDays: 30, approvalDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    { clientName: 'TechVision LLC', clientEmail: 'legal@techvision.ae', clientType: 'Preferred', service: 'Patent', procedure: 'Filing (New Application)', country: 'United Arab Emirates', numberOfClasses: 1, fees: { governmentFee: 3500, serviceFee: 4500, classFee: 0, procedureFee: 0 }, multiplier: 0.9, currency: 'SAR', status: 'Pending', validDays: 30 },
    { clientName: 'Global Innovations Inc.', clientEmail: 'ip@globalinnovations.com', clientType: 'VIP', service: 'Trademark', procedure: 'Renewal', country: 'United States', numberOfClasses: 2, fees: { governmentFee: 1800, serviceFee: 2200, classFee: 300, procedureFee: 0 }, multiplier: 0.8, currency: 'SAR', status: 'Approved', validDays: 30, approvalDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    { clientName: 'Saudi Industrial Corp', clientEmail: 'trademarks@sic.sa', clientType: 'Standard', service: 'Design', procedure: 'Filing (New Application)', country: 'Saudi Arabia', numberOfClasses: 1, fees: { governmentFee: 1000, serviceFee: 1500, classFee: 0, procedureFee: 0 }, multiplier: 1.0, currency: 'SAR', status: 'Draft', validDays: 30 },
    { clientName: 'Dr. Ahmed Al-Rashid', clientEmail: 'ahmed.rashid@gmail.com', clientType: 'Standard', service: 'Trademark', procedure: 'Filing (New Application)', country: 'Germany', numberOfClasses: 1, fees: { governmentFee: 1900, serviceFee: 2300, classFee: 360, procedureFee: 0 }, multiplier: 1.0, currency: 'SAR', status: 'Pending', validDays: 30 },
    { clientName: 'Kuwait Finance House', clientEmail: 'legal@kfh.com.kw', clientType: 'Government', service: 'Trademark', procedure: 'Filing (New Application)', country: 'Kuwait', numberOfClasses: 5, fees: { governmentFee: 1400, serviceFee: 1900, classFee: 280, procedureFee: 0 }, multiplier: 1.2, currency: 'SAR', status: 'Approved', validDays: 30, approvalDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
  ];

  let qc = 0, qs = 0;
  for (let i = 0; i < sampleQuotations.length; i++) {
    const q = sampleQuotations[i];
    const year = new Date().getFullYear();
    const quotationNo = `QT-${year}-${String(i + 1).padStart(4, '0')}`;
    const exists = await Quotation.findOne({ quotationNo });
    if (exists) { qs++; continue; }

    const subtotal = q.fees.governmentFee + q.fees.serviceFee + (q.fees.classFee * q.numberOfClasses) + q.fees.procedureFee;
    const total = subtotal * q.multiplier;

    const client = allClients.find(c => c.email === q.clientEmail);
    await Quotation.create({
      ...q,
      quotationNo,
      clientId: client?._id,
      subtotal,
      total,
      createdBy: adminUser?._id,
      approvedBy: q.status === 'Approved' ? adminUser?._id : undefined,
    });
    qc++;
  }
  log('📄', `Quotations   created: ${qc}  skipped: ${qs}`);

  console.log('\n✅  Seed complete!\n');
  console.log('  Demo accounts:');
  console.log('  ┌─────────────────────────────┬──────────────────┬──────────┐');
  console.log('  │ Name                        │ Email            │ Password │');
  console.log('  ├─────────────────────────────┼──────────────────┼──────────┤');
  console.log('  │ Demo Admin                  │ admin@demo.com   │ demo1234 │');
  console.log('  │ Demo Manager                │ manager@demo.com │ demo1234 │');
  console.log('  │ Demo User                   │ user@demo.com    │ demo1234 │');
  console.log('  └─────────────────────────────┴──────────────────┴──────────┘\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
