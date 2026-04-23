import { prisma } from '../db.js';

const toDateOrNull = (value) => (value ? new Date(value) : null);

export const UserModel = {
  findByPhone(phone) {
    return prisma.user.findUnique({ where: { phoneNumber: phone } });
  },

  findById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  create({ phone_number, display_name }) {
    return prisma.user.create({
      data: {
        phoneNumber: phone_number,
        displayName: display_name || null,
      },
    });
  },

  async findOrCreate(phone_number, display_name) {
    const existing = await this.findByPhone(phone_number);
    if (existing) return existing;
    return this.create({ phone_number, display_name });
  },

  updateName(id, display_name) {
    return prisma.user.update({
      where: { id },
      data: { displayName: display_name },
    });
  },

  findManyByTrip(tripId) {
    return prisma.tripMember.findMany({
      where: { tripId },
      include: { user: true },
    });
  },
};

export const PreferenceModel = {
  getForUser(userId) {
    return prisma.userPreference.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  },

  set(userId, category, key, value, source = 'inferred', confidence = 0.5) {
    return prisma.userPreference.upsert({
      where: {
        userId_category_key: { userId, category, key },
      },
      update: {
        value,
        source,
        confidence: source === 'explicit' ? Math.max(confidence, 0.9) : confidence,
      },
      create: {
        userId,
        category,
        key,
        value,
        source,
        confidence,
      },
    });
  },
};

export const TripModel = {
  findById(id) {
    return prisma.trip.findUnique({ where: { id } });
  },

  findAllForUser(userId) {
    return prisma.trip.findMany({
      where: {
        members: { some: { userId } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  findActiveForUser(userId) {
    return prisma.trip.findFirst({
      where: {
        members: { some: { userId } },
        status: { in: ['planning', 'booked', 'active'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  create({ name, start_date, end_date, budget_total, budget_currency, travel_style, notes }) {
    return prisma.trip.create({
      data: {
        name,
        startDate: toDateOrNull(start_date),
        endDate: toDateOrNull(end_date),
        budgetTotal: budget_total ?? null,
        budgetCurrency: budget_currency || 'USD',
        travelStyle: travel_style || null,
        notes: notes || null,
      },
    });
  },

  update(id, fields) {
    const data = {};
    if (fields.name !== undefined) data.name = fields.name;
    if (fields.status !== undefined) data.status = fields.status;
    if (fields.start_date !== undefined) data.startDate = toDateOrNull(fields.start_date);
    if (fields.end_date !== undefined) data.endDate = toDateOrNull(fields.end_date);
    if (fields.budget_total !== undefined) data.budgetTotal = fields.budget_total;
    if (fields.budget_currency !== undefined) data.budgetCurrency = fields.budget_currency;
    if (fields.travel_style !== undefined) data.travelStyle = fields.travel_style;
    if (fields.notes !== undefined) data.notes = fields.notes;

    return prisma.trip.update({ where: { id }, data });
  },

  addMember(tripId, userId, role = 'member') {
    return prisma.tripMember.upsert({
      where: { tripId_userId: { tripId, userId } },
      update: { role },
      create: { tripId, userId, role },
    });
  },

  async getMembers(tripId) {
    const links = await prisma.tripMember.findMany({ where: { tripId }, include: { user: true } });
    return links.map((m) => ({ ...m.user, role: m.role }));
  },
};

export const DestinationModel = {
  findByTrip(tripId) {
    return prisma.destination.findMany({
      where: { tripId },
      orderBy: { orderIndex: 'asc' },
    });
  },

  create({ trip_id, name, country, arrival_date, departure_date, order_index, notes }) {
    return prisma.destination.create({
      data: {
        tripId: trip_id,
        name,
        country: country || null,
        arrivalDate: toDateOrNull(arrival_date),
        departureDate: toDateOrNull(departure_date),
        orderIndex: Number.isFinite(order_index) ? order_index : 0,
        notes: notes || null,
      },
    });
  },

  update(id, fields) {
    const data = {};
    if (fields.name !== undefined) data.name = fields.name;
    if (fields.country !== undefined) data.country = fields.country;
    if (fields.arrival_date !== undefined) data.arrivalDate = toDateOrNull(fields.arrival_date);
    if (fields.departure_date !== undefined) data.departureDate = toDateOrNull(fields.departure_date);
    if (fields.order_index !== undefined) data.orderIndex = fields.order_index;
    if (fields.notes !== undefined) data.notes = fields.notes;

    return prisma.destination.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.destination.delete({ where: { id } });
  },
};

export const ItineraryModel = {
  findByDestination(destinationId) {
    return prisma.itineraryItem.findMany({
      where: { destinationId },
      orderBy: [{ dayNumber: 'asc' }, { timeSlot: 'asc' }],
    });
  },

  findByTrip(tripId) {
    return prisma.itineraryItem.findMany({
      where: { destination: { tripId } },
      include: { destination: true },
      orderBy: [{ destination: { orderIndex: 'asc' } }, { dayNumber: 'asc' }, { timeSlot: 'asc' }],
    });
  },

  create({ destination_id, day_number, time_slot, title, description, category, estimated_cost, notes }) {
    return prisma.itineraryItem.create({
      data: {
        destinationId: destination_id,
        dayNumber: day_number ?? null,
        timeSlot: time_slot || null,
        title,
        description: description || null,
        category: category || null,
        estimatedCost: estimated_cost ?? null,
        notes: notes || null,
      },
    });
  },
};

export const TaskModel = {
  findByTrip(tripId, status = null) {
    const where = status ? { tripId, status } : { tripId };
    return prisma.task.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  },

  findById(id) {
    return prisma.task.findUnique({ where: { id } });
  },

  create({ trip_id, assigned_to, title, description, category, priority, due_date, reminder_at }) {
    return prisma.task.create({
      data: {
        tripId: trip_id,
        assignedTo: assigned_to || null,
        title,
        description: description || null,
        category: category || null,
        priority: priority || 'medium',
        dueDate: toDateOrNull(due_date),
        reminderAt: toDateOrNull(reminder_at),
      },
    });
  },

  updateStatus(id, status) {
    return prisma.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'completed' ? new Date() : null,
      },
    });
  },

  getDueReminders(now = new Date()) {
    return prisma.task.findMany({
      where: {
        status: { in: ['pending', 'in_progress'] },
        reminderAt: { not: null, lte: now },
      },
      include: { trip: true, assignee: true },
    });
  },
};

export const ConversationModel = {
  async findOrCreateByChatId(chatId, tripId = null) {
    const existing = await prisma.conversation.findUnique({ where: { chatId } });
    if (existing) return existing;

    return prisma.conversation.create({
      data: {
        chatId,
        tripId,
      },
    });
  },

  linkTrip(conversationId, tripId) {
    return prisma.conversation.update({
      where: { id: conversationId },
      data: { tripId },
    });
  },

  getRecentMessages(conversationId, limit = 20) {
    return prisma.message.findMany({
      where: { conversationId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }).then((rows) => rows.reverse().map((m) => ({ ...m, user_name: m.user?.displayName || null })));
  },

  addMessage(conversationId, userId, role, content, intent = null) {
    return prisma.message.create({
      data: {
        conversationId,
        userId: userId || null,
        role,
        content,
        intent,
      },
    });
  },
};

export const DecisionModel = {
  findByTrip(tripId) {
    return prisma.decision.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
    });
  },

  create({ trip_id, topic, decision, decided_by, context }) {
    return prisma.decision.create({
      data: {
        tripId: trip_id,
        topic,
        decision,
        decidedBy: decided_by || 'both',
        context: context || null,
      },
    });
  },
};
