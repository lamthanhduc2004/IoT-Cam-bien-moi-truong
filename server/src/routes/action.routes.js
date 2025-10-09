import express from 'express';
import { getAllActions } from '../controllers/action.controller.js';

const router = express.Router();

// Get device actions history with pagination and filters
router.get('/devices/:id/actions', getAllActions);

export default router;

