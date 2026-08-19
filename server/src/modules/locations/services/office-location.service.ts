import mongoose from "mongoose";
import OfficeLocation from "../models/office-location.model.js";
import User from "../../auth/models/user.model.js";
import AppError from "../../../common/errors/app-error.js";

export class OfficeLocationService {
  /**
   * List Office Locations for Tenant (LOC-001)
   */
  async getLocations(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    return OfficeLocation.find({ organizationId: orgObjectId }).sort({ isPrimary: -1, name: 1 });
  }

  /**
   * Get Location by ID (LOC-002)
   */
  async getLocationById(orgId: string | mongoose.Types.ObjectId, locationId: string) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    return OfficeLocation.findOne({
      _id: new mongoose.Types.ObjectId(locationId),
      organizationId: orgObjectId,
    });
  }

  /**
   * Create Office Location Facility (LOC-001)
   */
  async createLocation(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: any
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    const location = await OfficeLocation.create({
      organizationId: orgObjectId,
      name: data.name || "Headquarters",
      code: data.code || `HQ-${Date.now().toString().slice(-4)}`,
      address: data.address || {
        street: "100 Enterprise Way",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
        country: "USA",
      },
      coordinates: data.coordinates || { lat: 37.7749, lng: -122.4194 },
      timezone: data.timezone || "America/Los_Angeles",
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      accessInfo: data.accessInfo || {
        wifiSsd: "Talnova-Guest-WiFi",
        wifiPassword: "WelcomeToTalnova!2026",
        buildingAccessCode: "KEY-9876",
        parkingInfo: "Visitor parking on B2 level, space 10-25.",
        arrivalInstructions: "Check in with security at the main lobby desk on Floor 1.",
      },
      floors: data.floors || [
        {
          floorNumber: 1,
          floorName: "Floor 1 — Lobby & Engineering",
          mapImageUrl: "/floor1-map.svg",
          desks: [
            { deskNumber: "101-A", zone: "DevOps", x: 10, y: 20, isAvailable: true },
            { deskNumber: "101-B", zone: "DevOps", x: 30, y: 20, isAvailable: true },
            { deskNumber: "102-A", zone: "Frontend", x: 50, y: 20, isAvailable: true },
          ],
        },
      ],
      isPrimary: data.isPrimary !== undefined ? data.isPrimary : false,
      createdBy: userObjectId,
    });

    return location;
  }

  /**
   * Update Office Location Facility
   */
  async updateLocation(
    orgId: string | mongoose.Types.ObjectId,
    locationId: string,
    data: any
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());

    const location = await OfficeLocation.findOne({
      _id: new mongoose.Types.ObjectId(locationId),
      organizationId: orgObjectId,
    });

    if (!location) {
      throw new AppError(404, "NOT_FOUND", "Office location facility not found");
    }

    if (data.name) location.name = data.name;
    if (data.address) location.address = data.address;
    if (data.accessInfo) location.accessInfo = data.accessInfo;
    if (data.floors) location.floors = data.floors;

    await location.save();
    return location;
  }

  /**
   * Delete Office Location Facility
   */
  async deleteLocation(orgId: string | mongoose.Types.ObjectId, locationId: string) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    return OfficeLocation.deleteOne({
      _id: new mongoose.Types.ObjectId(locationId),
      organizationId: orgObjectId,
    });
  }

  /**
   * Assign Employee to Specific Desk/Seat (LOC-003)
   */
  async assignEmployeeDesk(
    orgId: string | mongoose.Types.ObjectId,
    locationId: string,
    floorNumber: number,
    deskNumber: string,
    targetUserId: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(targetUserId);

    const targetUser = await User.findOne({
      _id: userObjectId,
      organizationId: orgObjectId,
    });

    if (!targetUser) {
      throw new AppError(404, "NOT_FOUND", "Employee user not found");
    }

    const location = await OfficeLocation.findOne({
      _id: new mongoose.Types.ObjectId(locationId),
      organizationId: orgObjectId,
    });

    if (!location) {
      throw new AppError(404, "NOT_FOUND", "Office location not found");
    }

    const floor = location.floors.find((f) => f.floorNumber === floorNumber);
    if (!floor) {
      throw new AppError(404, "NOT_FOUND", `Floor number ${floorNumber} not found in location`);
    }

    const desk = floor.desks.find((d) => d.deskNumber === deskNumber);
    if (!desk) {
      throw new AppError(404, "NOT_FOUND", `Desk number ${deskNumber} not found on floor ${floorNumber}`);
    }

    // Assign desk
    desk.assignedUserId = userObjectId;
    desk.assignedUserName = `${targetUser.profile.firstName} ${targetUser.profile.lastName}`;
    desk.isAvailable = false;

    await location.save();

    return {
      location,
      assignedDesk: desk,
      user: targetUser,
    };
  }

  /**
   * Get Employee Location-Aware Guidance & Map Info (LOC-004)
   */
  async getEmployeeLocationGuidance(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    // Find primary or assigned location
    let location = await OfficeLocation.findOne({
      organizationId: orgObjectId,
      "floors.desks.assignedUserId": userObjectId,
    });

    if (!location) {
      location = await OfficeLocation.findOne({ organizationId: orgObjectId, isPrimary: true });
    }

    if (!location) {
      location = await OfficeLocation.findOne({ organizationId: orgObjectId });
    }

    if (!location) {
      return null;
    }

    // Find specific assigned desk if present
    let assignedDesk: any = null;
    let assignedFloorNumber: number | null = null;

    for (const floor of location.floors) {
      const d = floor.desks.find((desk) => desk.assignedUserId?.toString() === userObjectId.toString());
      if (d) {
        assignedDesk = d;
        assignedFloorNumber = floor.floorNumber;
        break;
      }
    }

    const encodedAddress = encodeURIComponent(
      `${location.address.street}, ${location.address.city}, ${location.address.country}`
    );

    return {
      locationId: location._id.toString(),
      name: location.name,
      address: location.address,
      accessInfo: location.accessInfo,
      assignedFloorNumber: assignedFloorNumber || 1,
      assignedDesk: assignedDesk || { deskNumber: "101-A", zone: "Engineering", isAvailable: false },
      googleMapsDirectionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
      floors: location.floors,
    };
  }
}
