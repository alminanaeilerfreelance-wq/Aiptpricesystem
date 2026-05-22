# IP Law Firm Quotation Management System

A complete full-stack application for managing quotations and client information for an IP Law Firm. Built with Next.js, MongoDB, and Tailwind CSS.

## Features

✅ **Dashboard** - Overview with statistics and charts
✅ **Quotation Management** - Create, view, update, and manage quotations
✅ **Client Management** - Manage client information
✅ **Service Management** - Define services and pricing
✅ **Fee Calculations** - Automatic calculation of fees and totals
✅ **Status Tracking** - Track quotation status (Draft, Pending, Approved, Rejected)
✅ **Reports** - Generate reports on quotations and revenue
✅ **Responsive Design** - Works on desktop and mobile devices
✅ **PDF Export** - Print quotations as PDF
✅ **User Authentication** - Secure login system

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **Charts**: Recharts
- **Authentication**: JWT
- **Forms**: React Hook Form
- **HTTP Client**: Axios

## Prerequisites

- Node.js 14+ and npm
- MongoDB Atlas account or local MongoDB installation
- Git

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd ip-law-firm-quotation-system
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your values:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ip_law_firm
NEXTAUTH_SECRET=your-random-secret-key
JWT_SECRET=your-jwt-secret-key
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 4. Start the development server
```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

## Project Structure

```
├── pages/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [action].js          # Authentication endpoints
│   │   ├── quotations/
│   │   │   └── [id].js              # Quotation CRUD operations
│   │   └── clients/
│   │       └── [id].js              # Client CRUD operations
│   ├── quotations/
│   │   ├── index.js                 # Quotations list
│   │   ├── new.js                   # Create new quotation
│   │   └── [id].js                  # Quotation details
│   ├── dashboard.js                 # Dashboard page
│   ├── clients.js                   # Clients page
│   ├── services.js                  # Services page
│   ├── reports.js                   # Reports page
│   ├── settings.js                  # Settings page
│   ├── _app.js                      # Next.js app wrapper
│   └── _document.js                 # HTML structure
├── components/
│   ├── Layout.js                    # Main layout with sidebar
│   ├── Dashboard.js                 # Dashboard component
│   └── QuotationForm.js             # Quotation form component
├── models/
│   ├── User.js                      # User schema
│   ├── Client.js                    # Client schema
│   ├── Quotation.js                 # Quotation schema
│   └── Service.js                   # Service schema
├── lib/
│   └── mongodb.js                   # MongoDB connection
├── styles/
│   └── globals.css                  # Global styles
├── package.json
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Quotations
- `GET /api/quotations/list` - Get all quotations
- `GET /api/quotations/[id]` - Get specific quotation
- `POST /api/quotations/list` - Create new quotation
- `PUT /api/quotations/[id]` - Update quotation
- `DELETE /api/quotations/[id]` - Delete quotation

### Clients
- `GET /api/clients/list` - Get all clients
- `GET /api/clients/[id]` - Get specific client
- `POST /api/clients/list` - Create new client
- `PUT /api/clients/[id]` - Update client
- `DELETE /api/clients/[id]` - Delete client

## Database Schema

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (admin, manager, user),
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Client
```javascript
{
  name: String,
  email: String,
  phone: String,
  country: String,
  address: String,
  city: String,
  type: String (Individual, Company, Organization),
  registrationNumber: String,
  taxId: String,
  notes: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Quotation
```javascript
{
  quotationNo: String (auto-generated),
  clientId: ObjectId (ref: Client),
  clientName: String,
  clientEmail: String,
  service: String (Trademark, Patent, Copyright, Design),
  procedure: String (Filing, Prosecution, Renewal, Opposition),
  country: String,
  numberOfClasses: Number,
  clientType: String,
  fees: {
    governmentFee: Number,
    serviceFee: Number,
    classFee: Number,
    procedureFee: Number
  },
  multiplier: Number,
  subtotal: Number,
  total: Number,
  currency: String,
  status: String (Draft, Pending, Approved, Rejected),
  validDays: Number,
  notes: String,
  createdBy: ObjectId (ref: User),
  approvedBy: ObjectId (ref: User),
  approvalDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Service
```javascript
{
  name: String,
  description: String,
  category: String (Trademark, Patent, Copyright, Design),
  basePrice: Number,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Usage Guide

### Creating a Quotation

1. Go to "Quotations" → "+ New Quotation"
2. Fill in client information
3. Select service type and procedure
4. Enter number of classes
5. Update fees as needed
6. Review the calculated total
7. Click "Calculate Quotation" to save

### Viewing Quotations

1. Go to "Quotations" to see all quotations
2. Filter by status (All, Draft, Pending, Approved, Rejected)
3. Click "View" to see full quotation details
4. Update status as needed
5. Print as PDF when ready

### Managing Clients

1. Go to "Clients"
2. Click "+ Add Client" to create new client
3. View and manage all clients in the list
4. Client information is linked to quotations

## Customization

### Adding Custom Services

Edit the services list in `pages/services.js` or add them through the API.

### Modifying Fee Structure

Update the fee calculations in `components/QuotationForm.js` and `pages/api/quotations/[id].js`.

### Changing Theme Colors

Edit the colors in `tailwind.config.js`:
```javascript
colors: {
  primary: '#2563eb',
  secondary: '#1e293b',
  accent: '#f59e0b',
}
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Set environment variables in Vercel dashboard
4. Click "Deploy"

### Deploy to Other Platforms

For Heroku, Netlify, or other platforms, follow their deployment guides while ensuring:
- MongoDB URI is properly configured
- Environment variables are set
- Node.js version is compatible

## Troubleshooting

### MongoDB Connection Error
- Check if MongoDB URL is correct
- Ensure IP address is whitelisted in MongoDB Atlas
- Verify network connectivity

### API Errors
- Check browser console for error messages
- Verify API endpoints are correct
- Ensure MongoDB is running (if local)

### Build Issues
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version compatibility

## Performance Optimization

- Implement pagination for large datasets
- Add caching for frequently accessed data
- Optimize images and assets
- Use database indexes for common queries

## Security Considerations

- Use HTTPS in production
- Implement role-based access control
- Add rate limiting for API endpoints
- Sanitize user inputs
- Keep dependencies updated

## Future Enhancements

- [ ] Email notifications for quotation status changes
- [ ] Document management system
- [ ] Advanced reporting and analytics
- [ ] Integration with payment systems
- [ ] Multi-language support
- [ ] Mobile app
- [ ] Real-time notifications
- [ ] Bulk operations
- [ ] Custom templates
- [ ] Audit logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Commit and push
5. Create a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please create an issue on GitHub or contact support.

## Changelog

### Version 1.0.0
- Initial release
- Dashboard with statistics
- Quotation management
- Client management
- Service management
- Reports page
- Settings page

---

**Built with ❤️ for IP Law Firms**
