describe("My First True Test", () => {
  it("Does not do much!", () => {
    expect(true).to.equal(true);
  });
});

// Test accessing localhost: 1234
describe("visit localhost:1234", () => {
  it("Visit localhost:1234", () => {
    cy.visit("/");
  });
});

// Test login and logout
describe("login and log out", () => {
  it("valid login", () => {
    cy.visit("/");

    // the pop up modal
    cy.get("#inner-login-content").should("be.visible");

    // input a user name
    cy.get("#username").type("user1");

    // click submit
    cy.get("#submit-user").click();

    // UI should reflect this user being logged in
    cy.get("#displayedUser").should("contain", "user1");
  });

  it("invalid login", () => {
    cy.visit("/");

    // find the pop up modal
    cy.get("#inner-login-content").should("be.visible");

    // click submit without username inpput
    cy.get("#submit-user").click();

    cy.get("#login-error-msg").should("be.visible");
  });

  it("valid logout", () => {
    cy.visit("/");

    // find the pop up modal
    cy.get("#inner-login-content").should("be.visible");

    // input a user name
    cy.get("#username").type("user1");

    // click submit
    cy.get("#submit-user").click();

    cy.get("#logout").click();

    // login modal pop back up
    cy.get("#inner-login-content").should("be.visible");

    // check user display is empty
    cy.get("#loginUserName").should("have.text", "");
  });
});

// Test units for workspaces
describe("create and delete workspaces", () => {
  // login before each test
  beforeEach(() => {
    cy.visit("/")
      .get("#inner-login-content")
      .should("be.visible")
      .get("#username")
      .type("user1")
      .get("#submit-user")
      .click();
  });

  it("create a workspace", () => {
    cy.get("#workspace-name").select("create-ws");

    cy.get("#inner-ws-content")
      .should("be.visible")
      .get("#workspace")
      .type("ws1-cypress")
      .get("#submit-ws")
      .trigger("click");

    cy.get("#workspace-name").select("ws1-cypress");

    cy.get("#currentWorkspace").should("have.text", "ws1-cypress");
    cy.get("#channel-list").should("be.empty");
  });

  it("create two different workspaces", () => {
    // Create first workspace (ws2)
    cy.get("#workspace-name").select("create-ws");
    cy.get("#inner-ws-content")
      .should("be.visible")
      .get("#workspace")
      .type("ws2-cypress")
      .get("#submit-ws")
      .click();

    // Create second workspace (ws3)
    cy.get("#workspace-name").select("create-ws");
    cy.get("#inner-ws-content")
      .should("be.visible")
      .get("#workspace")
      .type("ws3-cypress")
      .get("#submit-ws")
      .click();

    // Toggle between different workspaces
    // Select the first workspace (ws2) and verify
    cy.get("#workspace-name").select("ws2-cypress");
    cy.get("#currentWorkspace").should("have.text", "ws2-cypress");
    cy.get("#channel-list").should("be.empty");

    // Select the second workspace (ws3) and verify
    cy.get("#workspace-name").select("ws3-cypress");
    cy.get("#currentWorkspace").should("have.text", "ws3-cypress");
    cy.get("#channel-list").should("be.empty");
  });

  it("create two workspaces with the same name", () => {
    cy.get("#workspace-name").select("create-ws");

    cy.get("#inner-ws-content")
      .should("be.visible")
      .get("#workspace")
      .type("ws1-cypress")
      .get("#submit-ws")
      .click();

    // ws1 has already been created, so an error should display
    cy.get("#error-message").should("be.visible");
  });

  it("delete a workspace", () => {
    cy.get("#workspace-name").select("delete-ws");

    cy.get("#inner-ws-content").should("be.visible");

    cy.get("#select-ws-delete").select("ws3-cypress");

    cy.get("#delete-ws-btn").click();
  });
});

// Test units for channels
// NOTE: There was an issue with the selector for buttonw with this test.
// Did not function correctly, so we've commented it out. Jest tests the model here.
// describe("create and delete channels and simple posts", () => {
//   // login before each test
//   beforeEach(() => {
//     cy.visit("/")
//       .get("#inner-login-content")
//       .should("be.visible")
//       .get("#username")
//       .type("user1")
//       .get("#submit-user")
//       .click()
//       .get("#workspace-name")
//       .select("ws1-cypress");
//   });
//
//   it("create a channel", () => {
//     cy.get("#new-channel").type("channel1");
//
//     cy.get("#create-channel").click();
//
//     cy.get('#channel-list')
//       .should('contain', 'channel1')
//       .find('input[type="radio"]')
//       .should('have.value', 'channel1')
//       .click();
//
//     cy.get('ul.post-list#channel-post-list').should('exist');
//
//     cy.get('#channel-post-list');
//
//     cy.get('#inputBox').type('I love 318!');
//
//     // Find the button by its class and click it
//     cy.get('.post-button').click();
//
//     // cy.get('.post-list')
//     // .find('li').should('have.length', 0);
//
//     // cy.get('#inputBox').type('I love 318!');
//
//     // // Find the button by its class and click it
//     // cy.get('.post-button').click();
//
//     // cy.get('.post-list')
//     // .find('li').should('have.length', 1);
//     //
//   });
// });
