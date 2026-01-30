import { Router } from 'express';
import messageController from '../controllers/messageController';
import { authenticate, checkRoomParticipant } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  sendMessageSchema,
  updateMessageSchema,
  messageIdSchema,
  roomIdSchema,
  messageQuerySchema,
  searchSchema,
} from '../validators/schemas';

const router = Router();

// All message routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Send a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomId
 *               - content
 *             properties:
 *               roomId:
 *                 type: string
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [text, image, file, audio, video]
 *               replyTo:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent successfully
 */
router.post('/', validate(sendMessageSchema), messageController.sendMessage);

/**
 * @swagger
 * /api/messages/unread:
 *   get:
 *     summary: Get total unread messages count
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total unread count
 */
router.get('/unread', messageController.getTotalUnreadCount);

/**
 * @swagger
 * /api/messages/room/{roomId}:
 *   get:
 *     summary: Get room messages
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
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
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: Message ID for cursor pagination
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *         description: Message ID for cursor pagination
 *     responses:
 *       200:
 *         description: List of messages
 */
router.get(
  '/room/:roomId',
  validate(roomIdSchema),
  validate(messageQuerySchema),
  checkRoomParticipant,
  messageController.getRoomMessages
);

/**
 * @swagger
 * /api/messages/room/{roomId}/read:
 *   post:
 *     summary: Mark all messages in room as read
 *     tags: [Messages]
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
 *         description: Messages marked as read
 */
router.post(
  '/room/:roomId/read',
  validate(roomIdSchema),
  checkRoomParticipant,
  messageController.markRoomAsRead
);

/**
 * @swagger
 * /api/messages/room/{roomId}/unread:
 *   get:
 *     summary: Get unread messages count for room
 *     tags: [Messages]
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
 *         description: Unread count
 */
router.get(
  '/room/:roomId/unread',
  validate(roomIdSchema),
  checkRoomParticipant,
  messageController.getUnreadCount
);

/**
 * @swagger
 * /api/messages/room/{roomId}/search:
 *   get:
 *     summary: Search messages in room
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
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
router.get(
  '/room/:roomId/search',
  validate(roomIdSchema),
  validate(searchSchema),
  checkRoomParticipant,
  messageController.searchMessages
);

/**
 * @swagger
 * /api/messages/{messageId}:
 *   get:
 *     summary: Get message by ID
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Message details
 */
router.get('/:messageId', validate(messageIdSchema), messageController.getMessageById);

/**
 * @swagger
 * /api/messages/{messageId}:
 *   put:
 *     summary: Update message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message updated successfully
 */
router.put(
  '/:messageId',
  validate(messageIdSchema),
  validate(updateMessageSchema),
  messageController.updateMessage
);

/**
 * @swagger
 * /api/messages/{messageId}:
 *   delete:
 *     summary: Delete message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Message deleted successfully
 */
router.delete('/:messageId', validate(messageIdSchema), messageController.deleteMessage);

/**
 * @swagger
 * /api/messages/{messageId}/read:
 *   post:
 *     summary: Mark message as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Message marked as read
 */
router.post('/:messageId/read', validate(messageIdSchema), messageController.markMessageAsRead);

/**
 * @swagger
 * /api/messages/{messageId}/receipts:
 *   get:
 *     summary: Get message read receipts
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Read receipts
 */
router.get(
  '/:messageId/receipts',
  validate(messageIdSchema),
  messageController.getMessageReadReceipts
);

export default router;