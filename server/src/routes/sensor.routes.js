import express from 'express';
import { getLatest, getTimeSeries, getAllSensors } from '../controllers/sensor.controller.js';

const router = express.Router();

// Get latest sensor data
router.get('/devices/:id/last', getLatest);

// Get time series data for charts
router.get('/devices/:id/series', getTimeSeries);

// Get all sensor data with pagination and smart search
router.get('/devices/:id/sensors', getAllSensors);

export default router;

