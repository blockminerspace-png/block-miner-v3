import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getVault, moveToVault, retrieveFromVault } from '../controllers/vaultController.js';

const router = express.Router();

// All vault routes require authentication
router.use(requireAuth);

// Get vault contents
router.get('/', getVault);

// Move machine to vault from inventory or rack
router.post('/move-to-vault', moveToVault);

// Retrieve machine from vault to inventory or rack
router.post('/retrieve-from-vault', retrieveFromVault);

export default router;
