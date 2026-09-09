import { db } from "./src/db/index.ts";
import { adminUsers } from "./src/db/schema.ts";
import bcrypt from "bcryptjs";

async function seed() {
    try {
        const hash = bcrypt.hashSync("diroboss@admin", 10);
        await db.insert(adminUsers).values({
            id: "admin-" + Date.now(),
            email: "doriboss",
            passwordHash: hash,
            role: "SUPERADMIN",
            active: true
        }).onConflictDoUpdate({
            target: adminUsers.email,
            set: { passwordHash: hash }
        });
        console.log("Admin user seeded successfully.");
    } catch (e) {
        console.error("Error seeding admin:", e);
    }
    process.exit(0);
}
seed();
