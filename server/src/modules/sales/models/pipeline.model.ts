import mongoose, { Schema, Document } from "mongoose";

export interface IPipelineStage {
  key: string;
  name: string;
  probability: number; // 0.0 to 1.0
  order: number;
  requiredFields?: string[];
  slaDays?: number;
}

export interface IPipeline extends Document {
  name: string;
  isDefault: boolean;
  stages: IPipelineStage[];
  createdAt: Date;
  updatedAt: Date;
}

const PipelineStageSchema = new Schema<IPipelineStage>({
  key: { type: String, required: true },
  name: { type: String, required: true },
  probability: { type: Number, required: true, min: 0, max: 1 },
  order: { type: Number, required: true },
  requiredFields: [{ type: String }],
  slaDays: { type: Number },
});

const PipelineSchema = new Schema<IPipeline>(
  {
    name: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false, index: true },
    stages: [PipelineStageSchema],
  },
  {
    timestamps: true,
  }
);

export const Pipeline = mongoose.model<IPipeline>("SalesPipeline", PipelineSchema);
export default Pipeline;
