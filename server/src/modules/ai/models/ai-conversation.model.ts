import mongoose, { Schema, Document } from "mongoose";

export interface IAICitation {
  title: string;
  url: string;
  articleId?: string;
}

export interface IAIActionSuggestion {
  text: string;
  action: string;
}

export interface IAIMessage {
  _id?: string;
  sender: "user" | "assistant";
  content: string;
  citations?: IAICitation[];
  actionSuggestions?: IAIActionSuggestion[];
  timestamp: Date;
}

export interface IAIFeedback {
  messageId: string;
  rating: "up" | "down";
  comment?: string;
  timestamp: Date;
}

export interface IAIConversation extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  messages: IAIMessage[];
  feedback: IAIFeedback[];
  createdAt: Date;
  updatedAt: Date;
}

const AICitationSchema = new Schema<IAICitation>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    articleId: { type: String },
  },
  { _id: false }
);

const AIActionSuggestionSchema = new Schema<IAIActionSuggestion>(
  {
    text: { type: String, required: true },
    action: { type: String, required: true },
  },
  { _id: false }
);

const AIMessageSchema = new Schema<IAIMessage>(
  {
    sender: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    citations: { type: [AICitationSchema], default: [] },
    actionSuggestions: { type: [AIActionSuggestionSchema], default: [] },
    timestamp: { type: Date, default: Date.now },
  }
);

const AIFeedbackSchema = new Schema<IAIFeedback>(
  {
    messageId: { type: String, required: true },
    rating: { type: String, enum: ["up", "down"], required: true },
    comment: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AIConversationSchema = new Schema<IAIConversation>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    title: { type: String, required: true, default: "Onboarding Chat" },
    messages: { type: [AIMessageSchema], default: [] },
    feedback: { type: [AIFeedbackSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

AIConversationSchema.index({ organizationId: 1, userId: 1 });

export const AIConversation = mongoose.model<IAIConversation>("AIConversation", AIConversationSchema);
export default AIConversation;
