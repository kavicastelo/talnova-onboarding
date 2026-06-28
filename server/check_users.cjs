const mongoose = require('mongoose');
const uri = "mongodb+srv://talnovainfo_db_user:sE6tqPUsf58Rcags@talnova.6ay8jvc.mongodb.net/Talnova-Onboarding?retryWrites=true&w=majority";

async function run() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB!");
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));
  
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log("Users in DB:");
  users.forEach(u => {
    console.log(`- Email: ${u.auth?.email}, Role: ${u.permissions?.role}, Name: ${u.profile?.firstName} ${u.profile?.lastName}`);
  });
  
  const orgs = await mongoose.connection.db.collection('organizations').find({}).toArray();
  console.log("Organizations in DB:");
  orgs.forEach(o => {
    console.log(`- Name: ${o.name}, Slug: ${o.slug}, ID: ${o._id}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
