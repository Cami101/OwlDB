import { jest, test, expect } from "@jest/globals";
const { ReadModel } = require("../src/model/ReadModel");

const token = "asdflasfdlkas";
const readModel = new ReadModel("http://localhost:4318/", "v1/fake-db", "auth");

/**
 * Represents the MOCK global fetch method for our testing purposes.
 */
global.fetch = jest.fn((url: any, options?: RequestInit): Promise<Response> => {
  let body = "";
  const headers = new Headers();
  let status = 0;
  let isOk = true;
  let statusText = "Okay";
  switch (options?.method) {
    case "GET":
      body = "{}";
      headers.set("Content-Type", "application/json");
      headers.append("Authorization", "Bearer " + token);
      status = 200;
      break;
  }

  // Create the response
  const output: Response = {
    ok: isOk,
    status: status,
    statusText: statusText,
    headers: headers,
    json: () => Promise.resolve(JSON.parse(body)),
  } as Response;
  return Promise.resolve(output);
});

test("get workspaces", async () => {
  readModel.getWorkspaces().then((response: any) => {
    console.log("Received response of " + response);
    expect("{}");
  });
});

test("get channels", async () => {
  readModel.getChannels("workspace").then((response: any) => {
    console.log("Received response of " + response);
    expect("{}");
  });
});

test("get posts", async () => {
  readModel.getPosts("workspace", "channel").then((response: any) => {
    console.log("Received response of " + response);
    expect("{}");
  });
});

test("get posts", async () => {
  readModel.getPosts("workspace", "channel").then((response: any) => {
    console.log("Received response of " + response);
    expect("{}");
  });
});
