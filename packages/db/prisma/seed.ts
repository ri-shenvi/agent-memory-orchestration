import { getPrismaClient } from "../src/client";

const connectionString =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === "production"
    ? undefined
    : "postgresql://memory_debugger:memory_debugger@localhost:5432/memory_debugger");

if (connectionString === undefined) {
  throw new Error("Database connection configuration is required.");
}

const prisma = getPrismaClient(connectionString);

const DEMO_WORKSPACE_ID = "demo-workspace";
const DEMO_AGENT_ID = "demo-order-assistant";
const DEMO_AGENT_USER_ID = "demo-user-123";
const DEMO_ORDER_ID = "demo-order-1042";

const memoryConfig = {
  enabled: true,
  recentMessageLimit: 12,
  recentMessageTokenBudget: 2000,
  semanticCandidateLimit: 30,
  importantCandidateLimit: 10,
  activeTypeCandidateLimit: 30,
  maxMemories: 12,
  contextTokenBudget: 1500,
  minSemanticSimilarity: 0.2,
  recencyHalfLifeDays: 30,
  semanticWeight: 0.5,
  recencyWeight: 0.2,
  importanceWeight: 0.15,
  confidenceWeight: 0.1,
  typeBoostWeight: 0.05,
  typeBoosts: {
    USER_PREFERENCE: 1,
    TASK: 0.9,
    DECISION: 0.9,
    FACT: 0.7,
    ENTITY: 0.6,
    CONVERSATION_SUMMARY: 0.5,
    TOOL_RESULT: 0.4,
  },
};

async function main(): Promise<void> {
  const workspace = await prisma.workspace.upsert({
    where: { id: DEMO_WORKSPACE_ID },
    update: { name: "Memory Debugger Demo" },
    create: {
      id: DEMO_WORKSPACE_ID,
      name: "Memory Debugger Demo",
    },
  });

  const agent = await prisma.agent.upsert({
    where: { id: DEMO_AGENT_ID },
    update: {
      workspaceId: workspace.id,
      slug: "order-assistant",
      name: "Order Assistant",
      systemPrompt:
        "Help users check order status and remember durable delivery preferences. Use order tools when current order data is required.",
      provider: "mock",
      protocol: "chat-completions",
      model: "mock-order-agent",
      memoryEnabled: true,
      memoryConfig,
    },
    create: {
      id: DEMO_AGENT_ID,
      workspaceId: workspace.id,
      slug: "order-assistant",
      name: "Order Assistant",
      systemPrompt:
        "Help users check order status and remember durable delivery preferences. Use order tools when current order data is required.",
      provider: "mock",
      protocol: "chat-completions",
      model: "mock-order-agent",
      memoryEnabled: true,
      memoryConfig,
    },
  });

  const agentUser = await prisma.agentUser.upsert({
    where: { id: DEMO_AGENT_USER_ID },
    update: {
      workspaceId: workspace.id,
      externalUserId: "user-123",
      displayName: "Demo User",
    },
    create: {
      id: DEMO_AGENT_USER_ID,
      workspaceId: workspace.id,
      externalUserId: "user-123",
      displayName: "Demo User",
    },
  });

  const order = await prisma.demoOrder.upsert({
    where: { id: DEMO_ORDER_ID },
    update: {
      workspaceId: workspace.id,
      externalUserId: agentUser.externalUserId,
      orderNumber: "ORD-1042",
      status: "IN_TRANSIT",
      estimatedDeliveryAt: new Date("2026-07-16T18:00:00.000Z"),
      deliveryLocation: "Pittsburgh apartment",
    },
    create: {
      id: DEMO_ORDER_ID,
      workspaceId: workspace.id,
      externalUserId: agentUser.externalUserId,
      orderNumber: "ORD-1042",
      status: "IN_TRANSIT",
      estimatedDeliveryAt: new Date("2026-07-16T18:00:00.000Z"),
      deliveryLocation: "Pittsburgh apartment",
    },
  });

  console.info("Seeded deterministic demo records", {
    workspace: { id: workspace.id, name: workspace.name },
    agent: { id: agent.id, slug: agent.slug },
    agentUser: { id: agentUser.id, externalUserId: agentUser.externalUserId },
    order: { id: order.id, orderNumber: order.orderNumber },
  });
}

await main().finally(async () => {
  await prisma.$disconnect();
});
