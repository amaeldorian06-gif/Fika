import { db } from "./src/db/index.ts";
import { orders, customers, leads, experts } from "./src/db/schema.ts";

async function run() {
  const o = await db.select().from(orders);
  const c = await db.select().from(customers);
  const l = await db.select().from(leads);
  const e = await db.select().from(experts);
  console.log("Orders:", o.length);
  console.log("Customers:", c.length);
  console.log("Leads:", l.length);
  console.log("Experts:", e.length);
  process.exit(0);
}
run();
