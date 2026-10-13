import appJson from "../app.json";

describe("app config", () => {
  it("has the fixed name and Android package", () => {
    expect(appJson.expo.name).toBe("Meow");
    expect(appJson.expo.android.package).toBe("com.isujaykumar.meow");
  });
});
