import { jest, test, expect } from "@jest/globals";
const { WriteModel } = require("../src/model/writeModel");

const token = "asdflasfdlkas";
const writeModel = new WriteModel(
  "http://localhost:4318/",
  "v1/fake-db",
  "auth",
);

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
    case "POST":
      body = '{"token":"asdflasfdlkas"}';
      headers.set("Content-Length", "" + body.length);
      status = 200;
      break;
    case "DELETE":
      status = 204;
      headers.set("Content-Type", "application/json");
      // Delete a user name does not need the rest of these headers
      if (url != "http://localhost:4318/auth") {
        headers.append("Authorization", "Bearer " + token);
        headers.append("Accept", "application/json");
      }
      break;
    case "PUT":
      body = "{}";
      headers.set("Accept", "application/json");
      headers.append("Authorization", "Bearer " + token);
      headers.append("Content-Type", "application/json");
      status = 201;
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

test("valid login", async () => {
  writeModel
    .loginUser("http://localhost:4318/auth", "testUser")
    .then((response: any) => {
      console.log("Received response of " + response);
      expect('{"token":"asdflasfdlkas"}');
    });
});

test("valid logout", async () => {
  writeModel.logoutUser("http://localhost:4318/auth").then((response: any) => {
    console.log("Received response of " + response);
    expect("");
  });
});

test("create new workspace", async () => {
  writeModel.putWorkspace("new-ws").then((response: any) => {
    console.log("Received response of " + response);
    expect("");
  });
});

test("delete a workspace", async () => {
  writeModel.deleteWorkspace("new-ws").then((response: any) => {
    console.log("Received response of " + response);
    expect("");
  });
});

test("create a new channel", async () => {
  writeModel.putChannel("new-ws", "channel").then((response: any) => {
    console.log("Received response of " + response);
    expect("{}");
  });
});
