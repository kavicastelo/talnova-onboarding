import mongoose, { Schema, Document } from "mongoose";

export interface IDesk {
  deskNumber: string;
  zone?: string;
  x?: number;
  y?: number;
  assignedUserId?: mongoose.Types.ObjectId;
  assignedUserName?: string;
  isAvailable: boolean;
}

export interface IFloorPlan {
  floorNumber: number;
  floorName: string;
  mapImageUrl?: string;
  desks: IDesk[];
}

export interface IAccessInfo {
  wifiSsd?: string;
  wifiPassword?: string;
  buildingAccessCode?: string;
  parkingInfo?: string;
  arrivalInstructions?: string;
}

export interface IOfficeAddress {
  street: string;
  city: string;
  state?: string;
  zip?: string;
  country: string;
}

export interface IOfficeLocation extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  address: IOfficeAddress;
  coordinates?: {
    lat: number;
    lng: number;
  };
  timezone: string;
  contactEmail?: string;
  contactPhone?: string;
  accessInfo: IAccessInfo;
  floors: IFloorPlan[];
  isPrimary: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DeskSchema = new Schema<IDesk>(
  {
    deskNumber: { type: String, required: true },
    zone: { type: String },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    assignedUserId: { type: Schema.Types.ObjectId, ref: "User" },
    assignedUserName: { type: String },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: false }
);

const FloorPlanSchema = new Schema<IFloorPlan>(
  {
    floorNumber: { type: Number, required: true },
    floorName: { type: String, required: true },
    mapImageUrl: { type: String },
    desks: { type: [DeskSchema], default: [] },
  },
  { _id: false }
);

const AccessInfoSchema = new Schema<IAccessInfo>(
  {
    wifiSsd: { type: String },
    wifiPassword: { type: String },
    buildingAccessCode: { type: String },
    parkingInfo: { type: String },
    arrivalInstructions: { type: String },
  },
  { _id: false }
);

const OfficeAddressSchema = new Schema<IOfficeAddress>(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    zip: { type: String },
    country: { type: String, required: true },
  },
  { _id: false }
);

const OfficeLocationSchema = new Schema<IOfficeLocation>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    name: { type: String, required: true },
    code: { type: String, required: true },
    address: { type: OfficeAddressSchema, required: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    timezone: { type: String, default: "UTC" },
    contactEmail: { type: String },
    contactPhone: { type: String },
    accessInfo: { type: AccessInfoSchema, default: {} },
    floors: { type: [FloorPlanSchema], default: [] },
    isPrimary: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  },
  {
    timestamps: true,
  }
);

OfficeLocationSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export const OfficeLocation = mongoose.model<IOfficeLocation>("OfficeLocation", OfficeLocationSchema);
export default OfficeLocation;
