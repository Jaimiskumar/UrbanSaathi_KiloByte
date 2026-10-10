import express from 'express';
import Fine from '../models/Fine.js';
import Challan from '../models/Challan.js';
import User from '../models/User.js';
import { io } from '../server.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { logAudit } from '../services/auditLogger.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [fines, challans] = await Promise.all([
      Fine.find().populate('userId', 'name email').sort({ issuedAt: -1 }).lean(),
      Challan.find().sort({ violationDateTime: -1, createdAt: -1 }).lean()
    ]);

    const mappedChallans = challans.map(c => ({
      _id: c._id,
      fineId: c.challanNumber,
      challanNumber: c.challanNumber,
      userId: null,
      vehicleNumber: c.vehicleNumber,
      ownerName: c.ownerName || 'Citizen Driver',
      ownerPhone: c.ownerPhone || '+91 98450 12345',
      ownerEmail: c.ownerEmail,
      vehicleModel: c.vehicleModel || 'Motor Vehicle',
      legalSection: c.legalSection || 'Section 184 / 129 Motor Vehicles Act',
      violationType: c.violationType,
      amount: c.fineAmount,
      fineAmount: c.fineAmount,
      currency: 'INR',
      location: { name: c.violationLocation },
      violationLocation: c.violationLocation,
      imageUrl: c.imageUrl,
      status: c.status || 'pending',
      paymentStatus: c.paymentStatus || 'pending',
      issuedAt: c.violationDateTime || c.createdAt || new Date(),
      description: c.description || `Traffic violation at ${c.violationLocation}`
    }));

    // Deduplicate by fineId / challanNumber
    const combined = [...mappedChallans, ...fines];
    res.json(combined);
  } catch (error) {
    console.error('Error fetching unified fines:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/issue', authMiddleware, requirePermission('fine:issue'), async (req, res) => {
  try {
    let { vehicleNumber, violationType, amount, location, imageUrl } = req.body;
    
    // Normalize vehicle number (uppercase, no spaces/dashes)
    const normalizedNumber = vehicleNumber ? vehicleNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';
    
    const owner = await User.findOne({ vehicleNumber: normalizedNumber });

    const fineId = `FINE${Date.now()}`;
    const fine = new Fine({
      fineId,
      userId: owner?._id || null,
      vehicleNumber: normalizedNumber || vehicleNumber,
      violationType,
      amount,
      currency: 'INR',
      location: typeof location === 'string' ? { name: location } : location,
      imageUrl,
      status: 'pending',
      warningIssued: true,
      warningTime: new Date(),
      issuedAt: new Date()
    });

    await fine.save();

    // Notify citizen in real-time
    io.emit('new-fine', {
        userId: owner?._id,
        vehicleNumber: normalizedNumber,
        fineId: fine.fineId
    });

    await logAudit({
      req,
      action: 'fine.issue',
      resourceType: 'fine',
      resourceId: fine._id.toString(),
      metadata: {
        fineId: fine.fineId,
        vehicleNumber,
        amount,
        currency: 'INR'
      }
    });

    res.status(201).json(fine);
  } catch (error) {
    await logAudit({
      req,
      action: 'fine.issue',
      resourceType: 'fine',
      status: 'failure',
      metadata: { error: error.message }
    });
    res.status(500).json({ message: error.message });
  }
});

// Settlement / Payment Endpoint for Citizens and Admins
router.post('/:id/pay', async (req, res) => {
  try {
    const id = req.params.id;
    let fine = await Fine.findById(id);
    let challan = null;

    if (!fine) {
      challan = await Challan.findOne({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { challanNumber: id }] });
    }

    if (!fine && !challan) {
      return res.status(404).json({ message: 'Fine/Challan record not found' });
    }

    if (fine) {
      fine.status = 'paid';
      fine.paidAt = new Date();
      await fine.save();
    }

    if (challan) {
      challan.status = 'paid';
      challan.paymentStatus = 'completed';
      challan.paymentDate = new Date();
      await challan.save();
    }

    // Broadcast real-time payment updates to both Admin and Citizen portals
    io.emit('fine-updated', { fineId: id, status: 'paid', timestamp: new Date() });
    io.emit('challan_paid', { challanId: id, status: 'paid', timestamp: new Date() });
    io.emit('admin_challan_updated', {
      type: 'challan_settled',
      id,
      status: 'paid',
      message: `💰 Fine payment settled for ${challan?.vehicleNumber || fine?.vehicleNumber || id}`
    });

    res.json({ success: true, message: 'Settlement complete', status: 'paid' });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authMiddleware, requirePermission('fine:cancel'), async (req, res) => {
  try {
    const deleted = await Fine.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Fine not found' });
    }

    await logAudit({
      req,
      action: 'fine.cancel',
      resourceType: 'fine',
      resourceId: req.params.id
    });

    console.log(`[REAL-TIME] Fine ${req.params.id} CANCELLED by Admin. Broadcasting.`);
    io.emit('fine-updated', {
        fineId: req.params.id,
        status: 'cancelled'
    });

    res.json({ message: 'Fine cancelled' });
  } catch (error) {
    await logAudit({
      req,
      action: 'fine.cancel',
      resourceType: 'fine',
      resourceId: req.params.id,
      status: 'failure',
      metadata: { error: error.message }
    });
    res.status(500).json({ message: error.message });
  }
});

export default router;
