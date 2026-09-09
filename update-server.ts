import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const overviewReplacement = `
  app.get("/api/admin/overview", async (req, res) => {
    try {
      const allOrders = await db.select().from(orders).execute();
      const allCustomers = await db.select().from(customers).execute();
      
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
          customerName: "Client", // Normally join with customers
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
      // Normally we'd join with customers, let's just do a basic map
      const mapped = allOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: "Client", 
        serviceName: "Service (via DB)",
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

  app.get("/api/admin/customers", async (req, res) => {
    try {
      const allCustomers = await db.select().from(customers).execute();
      res.json(allCustomers.map(c => ({
        id: c.id,
        name: c.name || "Client Anonyme",
        phone: c.phone,
        email: c.email,
        totalOrders: 1, // mocked count
        totalSpent: Number(c.totalSpent || 0),
        createdAt: c.createdAt.toISOString()
      })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/admin/experts", async (req, res) => {
    try {
      const allExperts = await db.select().from(experts).execute();
      res.json(allExperts.map(e => ({
        ...e,
        createdAt: e.createdAt.toISOString()
      })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
`;

// Replace the dummy overview with the real endpoints and add missing imports
content = content.replace(/import \{ adminUsers \} from "\.\/src\/db\/schema\.ts";/, 'import { adminUsers, orders, customers, experts, leads } from "./src/db/schema.ts";');

const targetToReplace = `  app.get("/api/admin/overview", async (req, res) => {
    // Provide a mocked overview for now, so the dashboard doesn't crash
    res.json({
      monthLabel: "Ce mois",
      revenue: 0,
      previousRevenue: 0,
      marginAmount: 0,
      marginPercent: 0,
      todoCount: 0,
      ordersCount: 0,
      averageBasket: 0,
      pipeline: {},
      topServices: [],
      recentOrders: []
    });
  });`;

content = content.replace(targetToReplace, overviewReplacement);

fs.writeFileSync('server.ts', content);
console.log("Updated server.ts successfully");
