import {
  createTransactionSchema,
  updateTransactionSchema,
  createUserSchema,
  loginSchema,
  transactionFilterSchema,
} from "../../validations/schemas";

describe("createTransactionSchema", () => {
  const validPayload = {
    amount: 1500.5,
    type: "INCOME",
    category: "Salary",
    date: "2024-03-01T00:00:00Z",
  };

  it("passes with valid data", () => {
    const result = createTransactionSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("fails with negative amount", () => {
    const result = createTransactionSchema.safeParse({ ...validPayload, amount: -100 });
    expect(result.success).toBe(false);
  });

  it("fails with zero amount", () => {
    const result = createTransactionSchema.safeParse({ ...validPayload, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("fails with invalid type", () => {
    const result = createTransactionSchema.safeParse({ ...validPayload, type: "TRANSFER" });
    expect(result.success).toBe(false);
  });

  it("fails with invalid date format", () => {
    const result = createTransactionSchema.safeParse({ ...validPayload, date: "2024-03-01" });
    expect(result.success).toBe(false);
  });

  it("fails with missing required fields", () => {
    const result = createTransactionSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("fails with too many tags", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    const result = createTransactionSchema.safeParse({ ...validPayload, tags });
    expect(result.success).toBe(false);
  });

  it("defaults tags to empty array when not provided", () => {
    const result = createTransactionSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });
});

describe("createUserSchema", () => {
  const validPayload = {
    name: "John Doe",
    email: "john@example.com",
    password: "SecurePass@1",
  };

  it("passes with valid data", () => {
    const result = createUserSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("fails with short name", () => {
    const result = createUserSchema.safeParse({ ...validPayload, name: "J" });
    expect(result.success).toBe(false);
  });

  it("fails with invalid email", () => {
    const result = createUserSchema.safeParse({ ...validPayload, email: "notanemail" });
    expect(result.success).toBe(false);
  });

  it("fails with weak password", () => {
    const result = createUserSchema.safeParse({ ...validPayload, password: "weak" });
    expect(result.success).toBe(false);
  });

  it("fails with password missing uppercase", () => {
    const result = createUserSchema.safeParse({ ...validPayload, password: "lowercase1" });
    expect(result.success).toBe(false);
  });

  it("defaults role to VIEWER", () => {
    const result = createUserSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("VIEWER");
    }
  });
});

describe("loginSchema", () => {
  it("passes with valid credentials", () => {
    const result = loginSchema.safeParse({ email: "user@test.com", password: "pass" });
    expect(result.success).toBe(true);
  });

  it("fails with missing password", () => {
    const result = loginSchema.safeParse({ email: "user@test.com" });
    expect(result.success).toBe(false);
  });

  it("fails with invalid email", () => {
    const result = loginSchema.safeParse({ email: "bad", password: "pass" });
    expect(result.success).toBe(false);
  });
});

describe("transactionFilterSchema", () => {
  it("defaults page, limit, sortBy, sortOrder", () => {
    const result = transactionFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortBy).toBe("createdAt");
      expect(result.data.sortOrder).toBe("desc");
    }
  });

  it("coerces string page and limit to numbers", () => {
    const result = transactionFilterSchema.safeParse({ page: "2", limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(50);
    }
  });

  it("fails with limit exceeding 100", () => {
    const result = transactionFilterSchema.safeParse({ limit: "200" });
    expect(result.success).toBe(false);
  });

  it("fails with invalid type", () => {
    const result = transactionFilterSchema.safeParse({ type: "TRANSFER" });
    expect(result.success).toBe(false);
  });
});
