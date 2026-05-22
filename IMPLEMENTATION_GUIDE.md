# IP Law Firm Quotation System - Implementation Guide

## Quick Start Guide

### Step 1: Prerequisites Check
Before you begin, ensure you have:
- Node.js v14 or higher installed
- npm or yarn package manager
- MongoDB account (MongoDB Atlas or local)
- Code editor (VS Code recommended)

Verify Node.js installation:
```bash
node --version 
npm --version
```

### Step 2: Project Setup

1. **Create project directory:**
```bash
mkdir ip-law-firm-system
cd ip-law-firm-system
```

2. **Copy all provided files** into the project directory maintaining the folder structure.

3. **Install dependencies:**
```bash
npm install
```

This will install all required packages:
- next, react, react-dom
- mongoose (MongoDB ODM)
- jsonwebtoken, bcryptjs (Authentication)
- recharts (Charts)
- tailwindcss, postcss, autoprefixer (Styling)
- And more...

### Step 3: Database Configuration

1. **Create MongoDB Database:**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free account
   - Create a new cluster
   - Get connection string

2. **Configure Environment:**
   ```bash
   cp .env.example .env.local
   ```

3. **Edit `.env.local`:**
   ```
   PORT=5001
   MONGODB_URI=mongodb+srv://<db_user>:<db_password>@inventoryai.8jgcmpw.mongodb.net/dashboard_db?retryWrites=true&w=majority
   MONGODB_DB=aipt_db
   NEXTAUTH_SECRET=generate-a-random-string-here
   JWT_SECRET=generate-another-random-string-here
   NODE_ENV=development
   GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
   UPLOAD_DIR=uploads
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ALERT_EMAIL=admin@aipt.com
   FRONTEND_URL=http://localhost:3000
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

**To generate random secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this twice to get two different secrets.

### Step 4: MongoDB Connection Test

Create a test file `test-db.js`:
```javascript
import connectDB from './lib/mongodb';
import User from './models/User';

async function test() {
  try {
    await connectDB();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
  }
  process.exit(0);
}

test();
```

Run: `node test-db.js`

### Step 5: Start Development Server

```bash
npm run dev
```

The application will be available at: `http://localhost:3000`

You should be automatically redirected to `/dashboard`

### Step 6: Initial Data Setup

1. **Create a test user:**
   - Use the API to register a new user
   - Or manually insert data into MongoDB

2. **Add sample clients:**
   - Go to Clients page
   - Click "+ Add Client"
   - Add test clients like "Al Khaleej Co." and "TechVision LLC"

3. **Create sample quotations:**
   - Go to Quotations → "+ New Quotation"
   - Select a client
   - Choose service type and procedure
   - Enter fees
   - Click "Calculate Quotation"

## File Structure Explanation

### Core Files

**`package.json`**
- Lists all project dependencies
- Defines npm scripts (dev, build, start, lint)

**`next.config.js`**
- Next.js configuration
- Controls build behavior

**`.env.example`**
- Template for environment variables
- Copy to `.env.local` and fill in your values

### Database Models (`/models`)

**`User.js`**
- User authentication schema
- Password hashing with bcrypt
- Password comparison method

**`Client.js`**
- Client information schema
- Stores company/individual details
- Links to quotations

**`Quotation.js`**
- Main quotation document
- Stores all quotation details
- Auto-generates quotation numbers
- Calculates fees and totals

**`Service.js`**
- Available services/packages
- Service pricing information

### API Routes (`/pages/api`)

**`auth/[action].js`**
- `/api/auth/register` - Register new user
- `/api/auth/login` - User login
- JWT token generation

**`quotations/[id].js`**
- GET - Fetch all or specific quotation
- POST - Create new quotation
- PUT - Update quotation
- DELETE - Delete quotation

**`clients/[id].js`**
- CRUD operations for clients
- Client data management

### Components (`/components`)

**`Layout.js`**
- Main layout wrapper
- Sidebar navigation
- Header with user info
- Responsive design

**`Dashboard.js`**
- Statistics cards
- Charts (Line, Pie)
- Recent quotations table

**`QuotationForm.js`**
- Form for creating quotations
- Fee calculations
- Input validation
- Real-time total calculation

### Pages (`/pages`)

**`dashboard.js`**
- Dashboard page wrapper
- Shows statistics and charts

**`quotations/index.js`**
- List all quotations
- Filter by status
- View/edit/delete quotations

**`quotations/new.js`**
- Create new quotation form
- Validation and submission

**`quotations/[id].js`**
- View quotation details
- Update status
- Print as PDF
- Fee breakdown display

**`clients.js`**
- Manage clients
- Add/view client information

**`services.js`**
- Available services
- Service pricing

**`reports.js`**
- Generate reports
- Dashboard analytics

**`settings.js`**
- System settings
- Company information
- Default configurations

## Configuration Guide

### Customizing Services

Edit `pages/services.js`:
```javascript
const services = [
  {
    id: 1,
    name: 'Trademark Filing',
    category: 'Trademark',
    basePrice: 2500,
    description: 'File a new trademark application',
  },
  // Add more services...
];
```

### Modifying Fee Structure

In `components/QuotationForm.js`, update the default fees:
```javascript
fees: {
  governmentFee: 1500,  // Change these values
  serviceFee: 2000,
  classFee: 300,
  procedureFee: 200,
}
```

### Changing Theme Colors

Edit `tailwind.config.js`:
```javascript
colors: {
  primary: '#2563eb',      // Blue
  secondary: '#1e293b',    // Dark slate
  accent: '#f59e0b',       // Amber
  // Add more colors...
}
```

### Adding Countries

In `components/QuotationForm.js`, update countries list:
```javascript
const countries = [
  'Saudi Arabia', 
  'UAE', 
  'China', 
  'USA',
  'Germany',  // Add new country
  'France',   // Add new country
];
```

## Database Indexes

For better performance, create indexes in MongoDB:

```javascript
// In MongoDB shell or compass
db.quotations.createIndex({ clientId: 1 });
db.quotations.createIndex({ status: 1 });
db.quotations.createIndex({ createdAt: -1 });
db.clients.createIndex({ email: 1 });
db.users.createIndex({ email: 1 });
```

## API Usage Examples

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Create Client
```bash
curl -X POST http://localhost:3000/api/clients/list \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Al Khaleej Co.",
    "email": "info@alkhaleej.com",
    "country": "Saudi Arabia",
    "type": "Company"
  }'
```

### Create Quotation
```bash
curl -X POST http://localhost:3000/api/quotations/list \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Al Khaleej Co.",
    "clientEmail": "info@alkhaleej.com",
    "service": "Trademark",
    "procedure": "Filing (New Application)",
    "country": "Saudi Arabia",
    "numberOfClasses": 3,
    "clientType": "Company",
    "fees": {
      "governmentFee": 1500,
      "serviceFee": 2000,
      "classFee": 300,
      "procedureFee": 200
    }
  }'
```

## Testing the Application

### Manual Testing Checklist

- [ ] Dashboard loads with statistics
- [ ] Can create a new quotation
- [ ] Fee calculations work correctly
- [ ] Status filters work
- [ ] Can view quotation details
- [ ] Can update quotation status
- [ ] Can print quotation as PDF
- [ ] Can add new client
- [ ] Can view client list
- [ ] Can access settings page

### Test Data to Create

1. **Test Client:**
   - Name: Test Company
   - Email: test@company.com
   - Country: Saudi Arabia
   - Type: Company

2. **Test Quotation:**
   - Service: Trademark
   - Procedure: Filing (New Application)
   - Classes: 3
   - Verify total calculation

## Deployment Checklist

Before deploying to production:

- [ ] Set secure environment variables
- [ ] Configure MongoDB for production
- [ ] Enable HTTPS
- [ ] Set up error logging
- [ ] Configure backups
- [ ] Test all features
- [ ] Optimize database indexes
- [ ] Set up monitoring
- [ ] Configure email notifications
- [ ] Document all changes

## Common Issues & Solutions

### Issue: MongoDB Connection Failed
**Solution:**
1. Check MongoDB URI in `.env.local`
2. Verify IP whitelist in MongoDB Atlas
3. Check network connectivity
4. Verify username/password

### Issue: Port 3000 Already in Use
**Solution:**
```bash
# Use different port
PORT=3001 npm run dev

# Or kill process using port 3000
# On Windows: netstat -ano | findstr :3000
# On Mac/Linux: lsof -i :3000 | grep LISTEN
```

### Issue: Module Not Found
**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: CSS Not Loading
**Solution:**
1. Clear `.next` folder: `rm -rf .next`
2. Rebuild: `npm run build`
3. Start dev server: `npm run dev`

## Performance Optimization Tips

1. **Add pagination to tables:**
   - Limit to 10-20 rows per page
   - Reduce initial load

2. **Optimize images:**
   - Use Next.js Image component
   - Compress before upload

3. **Database optimization:**
   - Create indexes for frequent queries
   - Use aggregation pipeline for reports

4. **Caching:**
   - Implement Redis for session caching
   - Cache API responses

## Next Steps

1. **Add Email Integration:**
   - Send quotation via email
   - Notification emails for status changes

2. **Enhanced Reporting:**
   - Monthly revenue reports
   - Client analytics
   - Service usage statistics

3. **Mobile App:**
   - React Native version
   - Mobile-first features

4. **Advanced Features:**
   - Document management
   - Payment integration
   - Automated follow-ups

## Master Data Definitions

### Services

- **Patent**
  - Description
- **Design**
  - Description
- **Trademark**
  - Description
- **Litigation**
  - Description

### Country

- Image Flag
- Country Name
- ABB (Country Abbreviation)

### Procedure

- **Trademark**: Procedure
- **Patent**: Procedure
- **Design**: Procedure
- **Litigation**: Procedure

### Client

- Client Name
- Address
- Email
- Type
- Country
- Company

### Classes

- Number
- Description

## Fee Schedule Pages by IP Type

Create dedicated fee schedule pages for each IP type:

- Trademark Fee Schedule Page
- Patent Fee Schedule Page
- Design Fee Schedule Page

Each page should:

- Display all procedures as grouped table headers.
- Show rows by country with image flag and country name.
- Include fee breakdown per procedure:
  - Official Fee (Government Fee)
  - Attorney Fee (Service Fee)
  - Total
- Allow users to customize row and column colors.
- Allow users to drag and drop rows and columns.
- Support editable table cells.

### Trademark Fee Schedule Table (Example)

| Image Flag | Country       |       Trademark Procedure 1         |      Trademark Procedure 2          |
| image      | country name  | Official Fee | Attorney Fee | Total | Official Fee | Attorney Fee | Total |

### Patent Fee Schedule Table (Example)

| Image Flag | Country       |       Patent Procedure 1            |      Patent Procedure 2             |
| image      | country name  | Official Fee | Attorney Fee | Total | Official Fee | Attorney Fee | Total |

### Design Fee Schedule Table (Example)

| Image Flag | Country       |       Design Procedure 1            |      Design Procedure 2             |
| image      | country name  | Official Fee | Attorney Fee | Total | Official Fee | Attorney Fee | Total |

Implementation notes:

- Procedure names should be dynamic and sourced from the Procedures module.
- Country rows should be dynamic and sourced from the Countries module.
- Total per procedure = Official Fee + Attorney Fee.
- Use compact enterprise table styling with sticky headers and horizontal scroll on mobile.

## Enterprise SaaS UI Design Requirements

### Design Requirements

- Match the same clean SaaS admin dashboard appearance
- Dark navy vertical sidebar
- White content background
- Thin borders and soft shadows
- Rounded cards
- Professional legal-tech branding
- Compact and elegant table layouts
- Corporate typography
- Light gray section backgrounds
- Blue primary action buttons
- Clean statistics cards
- Professional chart section
- Modern quotation PDF styling
- Enterprise quotation management UI

### Layout Structure

#### Left Sidebar Navigation

Use the same structure as the reference image:

- Dashboard
- New Quotation
- All Quotations
- Services
- Countries
- Procedures
- Client Types
- Pricing Rules
- Quotations Report
- Revenue Report
- Users
- Profile
- Logout

#### Sidebar Style

- Dark navy background
- White logo text
- Blue active menu highlight
- Thin icon set
- Compact spacing
- Professional SaaS navigation style

### Dashboard Design

Replicate the dashboard card layout with:

- Total Quotations
- Approved Quotations
- Pending Quotations
- Total Value (SAR)

Use:

- Pastel card backgrounds
- Thin borders
- Rounded corners
- Minimal icons
- Professional spacing

Below cards include:

- Line chart for quotation overview
- Pie chart for top countries
- Recent quotations table

### Recent Quotations Table Style

- Compact rows
- Minimal borders
- Status badges:
  - Green = Approved
  - Yellow = Pending
  - Gray = Draft

### New Quotation Page

Match a professional two-column form design.

Left side:

- Client Name
- Email
- Service
- Procedure
- Client Type

Right side:

- Country dropdown
- Number of Classes
- Calculate Quotation button

Below:

#### Calculation Summary Card

Use:

- Bordered summary section
- Aligned fee rows
- Green highlighted total row
- Professional accounting layout

### Quotation Details Page

Use the same layout structure.

Top action buttons:

- Approve
- Download PDF
- Send Email

Information cards:

- Client Information
- Quotation Information

Bottom section:

- Fee Breakdown table
- Terms & Conditions

Use:

- Professional invoice layout
- Light borders
- Minimal shadows
- Corporate spacing

### PDF Quotation Design

Create a printable PDF matching professional quotation styling.

Include:

- IP LAW FIRM logo
- Quotation number
- Client information
- Quotation information
- Professional fee table
- Green highlighted total
- Signature section
- Official stamp area
- Terms and conditions footer

### Table Design Requirements

All tables must follow a clean accounting style:

- Minimalist borders
- Soft gray headers
- Tight row spacing
- Compact typography
- Right-aligned currency values
- Clean accounting appearance
- Professional invoice structure

### UI Styling

Use:

- Tailwind CSS
- Next.js 14
- React
- Recharts
- Heroicons or Lucide icons

Color palette:

- Navy Blue: `#0B1739`
- Royal Blue: `#2563EB`
- Light Gray: `#F5F7FA`
- Border Gray: `#E5E7EB`
- Green: `#22C55E`
- Yellow: `#F59E0B`
- Red: `#EF4444`

Typography:

- Clean sans-serif
- Medium font weights
- Compact admin dashboard spacing

### Design Goal

The system should look like a premium legal-tech SaaS platform used by international intellectual property law firms.

## Support Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [MongoDB Atlas Guide](https://docs.atlas.mongodb.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Recharts Documentation](https://recharts.org/)

---

**You're now ready to run the IP Law Firm Quotation Management System!**

Start with: `npm run dev`

Access at: `http://localhost:3000`
