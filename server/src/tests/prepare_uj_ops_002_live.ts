import mongoose from 'mongoose';
import dotenv from 'dotenv';
import OfficeLocation from '../modules/locations/models/office-location.model.js';
import User from '../modules/auth/models/user.model.js';
import Organization from '../modules/organizations/models/organization.model.js';

dotenv.config();

async function prepare() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const orgs = await Organization.find({ isDeleted: false });
  console.log('Organizations found:', orgs.map(o => ({ id: o._id, name: o.name })));

  for (const org of orgs) {
    const users = await User.find({ organizationId: org._id, isDeleted: { $ne: true } });
    const adminUser = users.find(u => u.permissions?.role === 'admin' || u.permissions?.role === 'owner') || users[0];
    const creatorId = adminUser?._id || new mongoose.Types.ObjectId();

    // Map teammates
    const sarah = users.find(u => u.profile?.firstName?.toLowerCase().includes('sarah') || u.auth?.email?.includes('sarah'));
    const michael = users.find(u => u.profile?.firstName?.toLowerCase().includes('michael') || u.auth?.email?.includes('michael'));
    const priya = users.find(u => u.profile?.firstName?.toLowerCase().includes('priya') || u.auth?.email?.includes('priya'));
    const david = users.find(u => u.profile?.firstName?.toLowerCase().includes('david') || u.auth?.email?.includes('david'));
    const elena = users.find(u => u.profile?.firstName?.toLowerCase().includes('elena') || u.auth?.email?.includes('elena'));
    const alex = users.find(u => u.profile?.firstName?.toLowerCase().includes('alex') || u.auth?.email?.includes('alex')) || adminUser;

    const floors = [
      {
        floorNumber: 1,
        floorName: "Floor 1 — Engineering & Operations",
        mapImageUrl: "/floor1-map.svg",
        desks: [
          {
            deskNumber: "101-A",
            zone: "DevOps & Cloud",
            x: 370,
            y: 110,
            assignedUserId: alex?._id,
            assignedUserName: alex?.profile?.fullName || "Alex Developer",
            isAvailable: false,
          },
          {
            deskNumber: "101-B",
            zone: "Engineering Core",
            x: 540,
            y: 110,
            assignedUserId: sarah?._id || new mongoose.Types.ObjectId(),
            assignedUserName: sarah?.profile?.fullName || "Sarah Connor",
            isAvailable: false,
          },
          {
            deskNumber: "102-A",
            zone: "Product Strategy",
            x: 370,
            y: 230,
            assignedUserId: michael?._id || new mongoose.Types.ObjectId(),
            assignedUserName: michael?.profile?.fullName || "Michael Chang",
            isAvailable: false,
          },
          {
            deskNumber: "102-B",
            zone: "Product Design",
            x: 540,
            y: 230,
            assignedUserId: priya?._id || new mongoose.Types.ObjectId(),
            assignedUserName: priya?.profile?.fullName || "Priya Patel",
            isAvailable: false,
          },
          {
            deskNumber: "103-A",
            zone: "Flex Hotdesk",
            x: 370,
            y: 350,
            isAvailable: true,
          },
          {
            deskNumber: "103-B",
            zone: "Flex Hotdesk",
            x: 540,
            y: 350,
            isAvailable: true,
          },
        ],
      },
      {
        floorNumber: 2,
        floorName: "Floor 2 — Executive & Growth",
        mapImageUrl: "/floor2-map.svg",
        desks: [
          {
            deskNumber: "201-A",
            zone: "Marketing & Growth",
            x: 370,
            y: 140,
            assignedUserId: david?._id || new mongoose.Types.ObjectId(),
            assignedUserName: david?.profile?.fullName || "David Kim",
            isAvailable: false,
          },
          {
            deskNumber: "201-B",
            zone: "Customer Success",
            x: 540,
            y: 140,
            assignedUserId: elena?._id || new mongoose.Types.ObjectId(),
            assignedUserName: elena?.profile?.fullName || "Elena Rostova",
            isAvailable: false,
          },
          {
            deskNumber: "202-A",
            zone: "Executive Suite",
            x: 370,
            y: 280,
            isAvailable: true,
          },
          {
            deskNumber: "202-B",
            zone: "Executive Suite",
            x: 540,
            y: 280,
            isAvailable: true,
          },
        ],
      },
    ];

    let loc = await OfficeLocation.findOne({ organizationId: org._id, isPrimary: true });
    if (!loc) {
      loc = await OfficeLocation.findOne({ organizationId: org._id });
    }

    if (!loc) {
      loc = await OfficeLocation.create({
        organizationId: org._id,
        name: "Talnova San Francisco HQ",
        code: `SFO-${org._id.toString().slice(-4).toUpperCase()}`,
        address: {
          street: "500 Howard Street, Suite 400",
          city: "San Francisco",
          state: "CA",
          zip: "94105",
          country: "USA",
        },
        coordinates: {
          lat: 37.7885,
          lng: -122.3985,
        },
        timezone: "America/Los_Angeles",
        contactEmail: "facilities@talnova.com",
        contactPhone: "+1 (415) 555-0199",
        accessInfo: {
          wifiSsd: "Talnova-Secure-5G",
          wifiPassword: "SFOHQ-Welcome2026!",
          buildingAccessCode: "KEY-5004",
          parkingInfo: "Visitor parking validation available at 2nd floor security desk.",
          arrivalInstructions: "Check in with the lobby iPad terminal to receive your guest visitor badge.",
        },
        floors,
        isPrimary: true,
        createdBy: creatorId,
      });
      console.log(`Created new primary office location for org ${org.name}:`, loc.name);
    } else {
      loc.floors = floors;
      loc.isPrimary = true;
      loc.accessInfo = {
        wifiSsd: "Talnova-Secure-5G",
        wifiPassword: "SFOHQ-Welcome2026!",
        buildingAccessCode: "KEY-5004",
        parkingInfo: "Visitor parking validation available at 2nd floor security desk.",
        arrivalInstructions: "Check in with the lobby iPad terminal to receive your guest visitor badge.",
      };
      await loc.save();
      console.log(`Updated office location for org ${org.name}:`, loc.name);
    }
  }

  await mongoose.disconnect();
  console.log('Seeding complete!');
}

prepare().catch(console.error);
