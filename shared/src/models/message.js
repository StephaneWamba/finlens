/**
 * MongoDB Message Model
 * Shared across services for message storage
 */
import mongoose, { Schema } from 'mongoose';
const MessageSchema = new Schema({
    conversation_id: {
        type: String,
        required: true,
        index: true,
    },
    sender_type: {
        type: String,
        enum: ['user', 'agent', 'system'],
        required: true,
        index: true,
    },
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    message_type: {
        type: String,
        enum: ['text', 'audio', 'video', 'file', 'image', 'system'],
        default: 'text',
        index: true,
    },
    attachments: {
        type: [Schema.Types.Mixed],
        default: [],
    },
    ai_metadata: {
        type: {
            model: String,
            tokens_used: Number,
            response_time_ms: Number,
            temperature: Number,
            finish_reason: String,
        },
        default: {},
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false },
});
// Compound indexes for common queries
MessageSchema.index({ conversation_id: 1, created_at: 1 });
MessageSchema.index({ conversation_id: 1, sender_type: 1, created_at: -1 });
MessageSchema.index({ conversation_id: 1, message_type: 1 });
// Index for AI metadata queries (analytics)
MessageSchema.index({ 'ai_metadata.model': 1, created_at: -1 });
export const Message = mongoose.model('Message', MessageSchema);
