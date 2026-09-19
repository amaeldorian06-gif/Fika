import { db } from "./src/db/index.ts";
import { orders, customers, leads, experts } from "./src/db/schema.ts";

async function run() {
  console.log("Seeding data...");
  try {
    // 1. Customers
    const cust1 = { id: "cust-1", phone: "690123456", name: "Awa Ndiaye", email: "awa@example.com", totalSpent: "25000" };
    const cust2 = { id: "cust-2", phone: "671234567", name: "Marc Kameni", email: "marc@example.com", totalSpent: "5000" };
    await db.insert(customers).values([cust1, cust2]).onConflictDoNothing();

    // 2. Experts
    const exp1 = { id: "exp-1", phone: "699999999", name: "Jean-Marc (Design)", cityId: "ngaoundere", status: "ACTIVE", successRate: 98, completedTasks: 45 };
    const exp2 = { id: "exp-2", phone: "688888888", name: "Fatou (Tech)", cityId: "ngaoundere", status: "ACTIVE", successRate: 100, completedTasks: 12 };
    await db.insert(experts).values([exp1, exp2]).onConflictDoNothing();

    // 3. Orders
    const ord1 = {
      id: "ord-1",
      orderNumber: "LS-2026-0001",
      status: "COMPLETED",
      customerId: "cust-1",
      source: "whatsapp",
      totalPrice: "25000",
      marginAmount: "10000",
      marginPercent: "40",
      paymentStatus: "PAID",
    };
    const ord2 = {
      id: "ord-2",
      orderNumber: "LS-2026-0002",
      status: "IN_PROGRESS",
      customerId: "cust-2",
      source: "whatsapp",
      totalPrice: "5000",
      marginAmount: "2500",
      marginPercent: "50",
      paymentStatus: "PAID",
    };
    // Need to cast the enum for status
    await db.insert(orders).values([ord1, ord2] as any).onConflictDoNothing();

    console.log("Seed successful.");
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
