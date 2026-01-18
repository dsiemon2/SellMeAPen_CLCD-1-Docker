import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import adminRouter from './routes/admin.js';
import { loadUser } from './middleware/auth.js';

const app = express();
const logger = pino();

app.use(cors());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.set('views', 'views');
app.set('view engine', 'ejs');

// Load user for all requests
app.use(loadUser);

// Health check endpoint for Docker
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'admin' });
});

// Admin routes
app.use('/admin', adminRouter);

// Redirect root to admin login
app.get('/', (req, res) => {
  res.redirect('/admin/login');
});

const port = process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : 8011;

app.listen(port, () => {
  logger.info(`Sell Me a Pen - Admin Panel running on :${port}`);
  logger.info(`Admin URL: http://localhost:${port}/admin?token=${process.env.ADMIN_TOKEN || 'admin'}`);
});
