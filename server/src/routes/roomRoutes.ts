import { Router } from 'express';
import roomController from '../controllers/roomController';
import { authenticate, checkRoomParticipant, checkRoomAdmin } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  createRoomSchema,
  updateRoomSchema,
  addParticipantsSchema,
  roomIdSchema,
  userIdSchema,
  paginationSchema,
  searchSchema,
} from '../validators/schemas';

const router = Router();

// All room routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - participantIds
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [direct, group, channel]
 *               description:
 *                 type: string
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Room created successfully
 */
router.post('/', validate(createRoomSchema), roomController.createRoom);

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: Get user's rooms
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of user's rooms
 */
router.get('/', validate(paginationSchema), roomController.getUserRooms);

/**
 * @swagger
 * /api/rooms/search:
 *   get:
 *     summary: Search rooms
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', validate(searchSchema), roomController.searchRooms);

/**
 * @swagger
 * /api/rooms/direct/{userId}:
 *   post:
 *     summary: Get or create direct message room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Direct room details
 */
router.post('/direct/:userId', validate(userIdSchema), roomController.getOrCreateDirectRoom);

/**
 * @swagger
 * /api/rooms/{roomId}:
 *   get:
 *     summary: Get room by ID
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Room details
 */
router.get('/:roomId', validate(roomIdSchema), checkRoomParticipant, roomController.getRoomById);

/**
 * @swagger
 * /api/rooms/{roomId}:
 *   put:
 *     summary: Update room details
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Room updated successfully
 */
router.put(
  '/:roomId',
  validate(roomIdSchema),
  validate(updateRoomSchema),
  checkRoomAdmin,
  roomController.updateRoom
);

/**
 * @swagger
 * /api/rooms/{roomId}:
 *   delete:
 *     summary: Delete/deactivate room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Room deleted successfully
 */
router.delete('/:roomId', validate(roomIdSchema), roomController.deleteRoom);

/**
 * @swagger
 * /api/rooms/{roomId}/participants:
 *   get:
 *     summary: Get room participants
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Room participants
 */
router.get(
  '/:roomId/participants',
  validate(roomIdSchema),
  checkRoomParticipant,
  roomController.getRoomParticipants
);

/**
 * @swagger
 * /api/rooms/{roomId}/participants:
 *   post:
 *     summary: Add participants to room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantIds
 *             properties:
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Participants added successfully
 */
router.post(
  '/:roomId/participants',
  validate(roomIdSchema),
  validate(addParticipantsSchema),
  checkRoomAdmin,
  roomController.addParticipants
);

/**
 * @swagger
 * /api/rooms/{roomId}/participants/{participantId}:
 *   delete:
 *     summary: Remove participant from room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: participantId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Participant removed successfully
 */
router.delete('/:roomId/participants/:participantId', roomController.removeParticipant);

/**
 * @swagger
 * /api/rooms/{roomId}/leave:
 *   post:
 *     summary: Leave room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Left room successfully
 */
router.post('/:roomId/leave', validate(roomIdSchema), roomController.leaveRoom);

/**
 * @swagger
 * /api/rooms/{roomId}/admins/{userId}:
 *   post:
 *     summary: Make user admin
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: User promoted to admin
 */
router.post('/:roomId/admins/:userId', checkRoomAdmin, roomController.makeAdmin);

/**
 * @swagger
 * /api/rooms/{roomId}/admins/{userId}:
 *   delete:
 *     summary: Remove admin privileges
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Admin privileges removed
 */
router.delete('/:roomId/admins/:userId', checkRoomAdmin, roomController.removeAdmin);

export default router;