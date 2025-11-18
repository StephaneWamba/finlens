/**
 * MongoDB Conversation Model
 * Shared across services for conversation management
 */
import mongoose, { Schema } from 'mongoose';
const ConversationSchema = new Schema({
    agent_id: {
        type: String,
        required: true,
        index: true,
    },
    company_id: {
        type: String,
        required: true,
        index: true,
    },
    contact_id: {
        type: String,
        index: true,
        sparse: true, // Index only if field exists
    },
    user_id: {
        type: String,
        index: true,
        sparse: true,
    },
    channel: {
        type: String,
        enum: ['chat', 'voice', 'video', 'email', 'sms'],
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['active', 'ended', 'archived'],
        default: 'active',
        index: true,
    },
    started_at: {
        type: Date,
        default: Date.now,
        index: true,
    },
    ended_at: {
        type: Date,
    },
    tags: {
        type: [String],
        default: [],
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
});
// Compound indexes for common queries
ConversationSchema.index({ company_id: 1, status: 1, started_at: -1 });
ConversationSchema.index({ company_id: 1, channel: 1, started_at: -1 });
ConversationSchema.index({ agent_id: 1, status: 1, started_at: -1 });
ConversationSchema.index({ contact_id: 1, started_at: -1 });
ConversationSchema.index({ user_id: 1, started_at: -1 });
ConversationSchema.index({ tags: 1 });
// Text index for search (if needed)
ConversationSchema.index({ 'metadata.custom_fields': 'text' });
export const Conversation = mongoose.model('Conversation', ConversationSchema);
