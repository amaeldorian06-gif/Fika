import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const replacement = `
  app.get("/api/admin/overview", async (req, res) => {
    try {
      const allOrders = await db.select().from(orders).execute();
      const allCustomers = await db.select().from(customers).execute();
      const customersById = Object.fromEntries(allCustomers.map(c => [c.id, c.name || "Client Anonyme"]));
      
      let revenue = 0;
      let marginAmount = 0;
      let ordersCount = allOrders.length;
      let todoCount = 0;
      const pipeline: Record<string, number> = {};

      for (const o of allOrders) {
        revenue += Number(o.totalPrice || 0);
        marginAmount += Number(o.marginAmount || 0);
        
        if (['NEW', 'QUALIFYING', 'PAID', 'ASSIGNED', 'IN_PROGRESS', 'QUALITY_CHECK'].includes(o.status)) {
          todoCount++;
        }

        pipeline[o.status] = (pipeline[o.status] || 0) + 1;
      }

      const marginPercent = revenue > 0 ? (marginAmount / revenue) * 100 : 0;
      const averageBasket = ordersCount > 0 ? revenue / ordersCount : 0;

      res.json({
        monthLabel: "Depuis le début",
        revenue,
        previousRevenue: 0,
        marginAmount,
        marginPercent,
        todoCount,
        ordersCount,
        averageBasket,
        pipeline,
        topServices: [], // Simplified for now
        recentOrders: allOrders.slice(0, 5).map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          customerName: customersById[o.customerId] || "Client inconnu",
          totalPrice: Number(o.totalPrice),
          marginAmount: Number(o.marginAmount),
          createdAt: o.createdAt.toISOString()
        }))
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/admin/orders", async (req, res) => {
    try {
      const allOrders = await db.select().from(orders).execute();
      const allCustomers = await db.select().from(customers).execute();
      const customersById = Object.fromEntries(allCustomers.map(c => [c.id, c.name || "Client Anonyme"]));
      
      const mapped = allOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: customersById[o.customerId] || "Client inconnu", 
        serviceName: "Prestation personnalisée", // fallback for now as there is no order_items table yet
        totalPrice: Number(o.totalPrice),
        marginAmount: Number(o.marginAmount),
        createdAt: o.createdAt.toISOString()
      }));
      res.json(mapped);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
`;

// Extract the chunk between app.get("/api/admin/overview", ...) and app.get("/api/admin/customers", ...)
const startIndex = content.indexOf('app.get("/api/admin/overview"');
const endIndex = content.indexOf('app.get("/api/admin/customers"');
if (startIndex !== -1 && endIndex !== -1) {
  content = content.slice(0, startIndex) + replacement.trim() + '\n\n  ' + content.slice(endIndex);
  fs.writeFileSync('server.ts', content);
  console.log("Updated server.ts successfully");
} else {
  console.log("Could not find the bounds to replace");
}
