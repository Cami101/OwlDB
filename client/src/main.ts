import { slog } from "./slog";
import { ReadModel } from "./model/readModel";
import { WriteModel } from "./model/writeModel";
import Helpers from "./helpers/helpers";

import {
  View,
  LoginEvent,
  LogoutEvent,
  CreateChannelEvent,
  DeleteChannelEvent,
} from "./view";
import { DbDocument } from "../types/dbdocument";
import { Post } from "../types/post";

/**
 * Represents one post document in our database.
 */
export type PostItem = {
  path: string;
  author: string;
  creationTime: number;
  contents: string;
  parent: string;
  reactions?: object;
  extensions?: object;
};

/**
 * Holds the desired post time
 * of a schedule sent post.
 */
export type extensionData = {
  scheduledTime: string;
};

/**
 * Declare names and types of environment variables.
 */
declare const process: {
  env: {
    DATABASE_HOST: string;
    DATABASE_PATH: string;
    AUTH_PATH: string;
  };
};

/**
 * Initial entry to point of the application.
 */
function main(): void {
  slog.info("Using database", [
    "database",
    `${process.env.DATABASE_HOST}${process.env.DATABASE_PATH}`,
  ]);
}

/* Register event handler to run after the page is fully loaded. */
document.addEventListener("DOMContentLoaded", () => {
  //
  main();

  const readModel = new ReadModel(
    process.env.DATABASE_HOST,
    process.env.DATABASE_PATH,
    process.env.AUTH_PATH,
  );

  const writeModel = new WriteModel(
    process.env.DATABASE_HOST,
    process.env.DATABASE_PATH,
    process.env.AUTH_PATH,
  );
  const view = new View();
  let currentWorkspace = "";

  login();
  logout();

  /**
   * Groups together functions relating to the loading of workspaces.
   * Queries model for workspace names, and parses them for corresponding components and view.
   */
  function handleWorkspaces() {
    /**
     * Parses doc names as an array of Documents for use by the workspace-btn component.
     * @param response An array of documents.
     */
    function parseDocNames(response: Array<DbDocument>): Array<string> {
      // Iterate through the doc names and return them
      // as a string array
      return response.map((val: DbDocument): string => {
        return val.path.substring(val.path.lastIndexOf("/") + 1).toString();
      });
    }

    /**
     * Parses post names as an array of Documents for use by the Channels.ts component.
     * @param responses an Array of documents from a GetPosts() in model.
     */
    function parsePostNames(responses: Array<Post>): Array<PostItem> {
      function formatPost(val: Post): PostItem {
        Helpers.checkPostValidity(val);

        return {
          path: val.path,
          author: val.meta.createdBy,
          creationTime: val.meta.createdAt,
          contents: val.doc.msg,
          parent: val.doc.parent!,
          reactions: val.doc.reactions,
          extensions: val.doc.extensions,
        };
      }

      return responses.map((doc: Post): PostItem => {
        return formatPost(doc);
      });
    }

    /**
     * Refresh the workspaces on command.
     */
    function refreshWorkspaces() {
      readModel
        .getWorkspaces()
        .then((response: Array<DbDocument>) => {
          response.forEach((a) => Helpers.checkDocumentValidity(a));

          // Creates an initWorkspaces event to send to the workspace-button component
          const wsList = parseDocNames(response);

          const initWorkspacesEvent = new CustomEvent("initWorkspacesEvent", {
            detail: { workspaces: wsList },
          });

          console.log("handleWorkspaces dispatched");
          // Login notification
          document.dispatchEvent(initWorkspacesEvent);
        })
        .catch((error) => {
          // Handle errors during JSON conversion here
          console.error("Error getting the workspaces:", error);
          /* The line below creates a new database if it does not yet exist, 
          uncomment ONLY FOR TESTING */
          // writeModel.putNewDatabase();
          view.displayError("There was an error getting the workspaces");
        });
    }

    refreshWorkspaces();

    /* Occurs when a user clicks on the refresh button. */
    document.addEventListener("refreshWorkspacesEvent", (e: Event) => {
      console.log("refreshWorkspacesEvent occured in main!");
      refreshWorkspaces();
    });

    /* Occurs when the user chooses a workspace from the dropdown. */
    document.addEventListener("workspaceChosenEvent", (e: Event) => {
      if (!Helpers.isCustomEvent(e))
        throw new Error("Error! Workspace event type incorrect.");
      // Now, we know if "e" is of the correct event type.
      console.log("WorkspaceChosenEvent", e);
      currentWorkspace = e.detail.currentWorkspace;
      view.displayCurrWorkspace(currentWorkspace);
      updateChannels(currentWorkspace);
    });

    /* Occurs when the user selects a channel from the radio buttons on the side. */
    document.addEventListener("channelSelectedEvent", (e: Event) => {
      if (!Helpers.isCustomEvent(e))
        throw new Error("Error! Channel event type incorrect.");

      // Now, we know if "e" is of the correct event type.
      console.log("channelSelectedEvent", e);

      // Get posts associated with channel from "Model"
      readModel
        .getPosts(
          encodeURI(currentWorkspace),
          encodeURI(e.detail.currentChannel),
        )
        .then((response: Array<Post>) => {
          const postItemList = parsePostNames(response);

          readModel.openLiveEventStream(
            currentWorkspace,
            e.detail.currentChannel,
          );

          const postsLoadedEvent = new CustomEvent("postsLoadedEvent", {
            detail: { postList: postItemList },
          });

          console.log("postsLoadedEvent dispatched");
          console.log(postItemList);
          // Login notification
          document.dispatchEvent(postsLoadedEvent);
        })
        .catch((error) => {
          console.log("Error getting posts");
          console.log(error);
          view.displayError(
            "There was an error getting the posts from '" +
              e.detail.currentChannel +
              "'",
          );
        });
    });

    // Occurs when the user chooses a workspace from the dropdown.
    document.addEventListener("refreshChannelsEvent", (e: Event) => {
      console.log("refreshChannelsEvent", e);
      console.log("CURRENT WORKSPACE = " + currentWorkspace);
      if (currentWorkspace == "") {
        view.displayError(
          "Please select a workspace. No workspace is selected",
        );
        console.log("Please select a workspace. No workspace is selected");
        return;
      }
      if (!Helpers.isCustomEvent(e))
        throw new Error("Error! Refresh Channels event type incorrect.");

      // Now, we know if "e" is of the correct event type.
      console.log("Received refreshChannelsEvent", e);
      console.log(e.detail.id);
      view.refreshChannel();
    });

    // Occurs when the user clicks on the refresh channels button
    document.addEventListener("refreshChannelsButtonEvent", (e: Event) => {
      console.log("refreshChannelsButtonEvent", e);
      readModel
        .getChannels(currentWorkspace)
        .then((response: Array<DbDocument>) => {
          response.forEach((a) => Helpers.checkDocumentValidity(a));
          view.displayAllChannels(response);
          console.log("Printed all channels");
        })
        .catch((error) => {
          console.error("Error getting the channels:", error);
          view.displayError("There was an error refreshing the channels.");
        });
    });

    // Occurs when the user creates a new workspace
    document.addEventListener("createWorkspaceEvent", (e: Event) => {
      console.log("INSIDE CREATE WORKSPACE EVENT IN MAIN");
      if (!Helpers.isCustomEvent(e))
        throw new Error("Error! Workspace event type incorrect.");

      // Now, we know if "e" is of the correct event type.
      console.log("createWorkspaceEvent received ", e);
      console.log("Creating the workspace: " + e.detail.workspace);
      writeModel
        .putWorkspace(encodeURI(e.detail.workspace))
        .then((response: Array<DbDocument>) => {
          writeModel.putWorkspaceChannels(encodeURI(e.detail.workspace));
        })
        .catch((error) => {
          console.log("Error creating workspace");
          console.log(error);
          view.displayError("Error creating workspace");
        });
      view.resetChannelDisplay();
      currentWorkspace = "";
    });

    // Occurs when the user creates a new workspace
    document.addEventListener("deleteWorkspaceEvent", (e: Event) => {
      console.log("INSIDE DELETE WORKSPACE EVENT IN MAIN");
      if (!Helpers.isCustomEvent(e))
        throw new Error("Error! Workspace event type incorrect.");

      // Now, we know if "e" is of the correct event type.
      console.log("deleteWorkspaceEvent received ", e);
      console.log("Deleting the workspace: " + e.detail.workspace);
      writeModel.deleteWorkspace(encodeURI(e.detail.workspace)); //todo: handle error?
      view.resetChannelDisplay();
      currentWorkspace = "";
    });

    // Occurs when the user submits a new post to the database.
    document.addEventListener("postCreatedEvent", (e: Event) => {
      if (!Helpers.isCustomEvent(e))
        throw new Error("Error! postCreatedEvent event type incorrect.");

      console.log("postCreatedEvent Received... Adding to DB");
      writeModel
        .createPost(currentWorkspace, view.getChannel(), e.detail.postData)
        .catch((error) => {
          console.log("Error creating the post");
          console.log(error);
          view.displayError("There was an error creating the post");
        });
    });

    // Occurs when the user submits a new reaction to a post in the database.
    document.addEventListener("reactionCreatedEvent", (e: Event) => {
      if (!Helpers.isCustomEvent(e))
        throw new Error("Error! reactionCreatedEvent event type incorrect.");

      const currentUser = document.getElementById("loginUserName")?.textContent;

      if (currentUser == null) {
        throw new Error("Error! currentUser unable to be found.");
      }
      writeModel
        .createReact(e.detail.reactionType, e.detail.targetPost, currentUser)
        .then((r) => {
          // Refresh the channel after new post made.
          // TODO: this comment ^ is not implemented?
        })
        .catch((error) => {
          console.log("Error creating the reaction");
          console.log(error);
          view.displayError("There was an error creating the reaction");
        });
    });

    /**
     * Updates the channel values when a workspace is chosen by getting
     * their names from the model.
     * @param workspaceName the name of the current workspace
     */
    function updateChannels(workspaceName: string): void {
      readModel
        .getChannels(encodeURI(workspaceName))
        .then((response: Array<DbDocument>) => {
          response.forEach((a) => Helpers.checkDocumentValidity(a));
          view.displayAllChannels(response);
        })
        .catch((error) => {
          console.log("Error Loading Channels");
          console.log(error);
          view.displayError("There was an error loading the channels");
        });
    }

    // Occurs when the user attempts to delete a channel
    document.addEventListener(
      "deleteChannelEvent",
      function (evt: CustomEvent<DeleteChannelEvent>) {
        console.log("deleteChannelEvent", evt);

        // DELETE the channel in the current workspace
        writeModel
          .deleteChannel(encodeURI(currentWorkspace), evt.detail.channel)
          .catch((error) => {
            console.log(error);
            view.displayError(error);
          })
          .then(() => {
            // GET the updated channels list
            updateChannels(currentWorkspace);
          })
          .catch((error) => {
            console.log(
              "Error deleting the channel '" + evt.detail.channel + "'",
            );
            console.log(error);
            view.displayError(
              "There was an error deleting the channel '" +
                evt.detail.channel +
                "'",
            );
          });
      },
    );

    // Occurs when the user attempts to create a channel
    document.addEventListener(
      "createChannelEvent",
      function (evt: CustomEvent<CreateChannelEvent>) {
        console.log("createChannelEvent", evt);
        console.log("CURRENT WORKSPACE = " + currentWorkspace);
        if (currentWorkspace == "") {
          const textInput = document.getElementById("new-channel");
          // Refill the text input box with the channel that was attempted to be created
          if (textInput) {
            (<HTMLInputElement>textInput).value = evt.detail.channel;
          }
          view.displayError(
            "Please select a workspace. No workspace is selected",
          );
          console.log("Please select a workspace. No workspace is selected");
          return;
        }
        // PUT the new channel in the current workspace
        writeModel
          .putChannel(encodeURI(currentWorkspace), evt.detail.channel)
          .catch((error) => {
            console.log(error);
            view.displayError(error);
          })
          .then(() => {
            // PUT the "posts" collection to the new channel
            writeModel
              .putChannelPosts(encodeURI(currentWorkspace), evt.detail.channel)
              .then(() => {
                // GET the channels again, since we have updated our channel list
                readModel
                  .getChannels(encodeURI(currentWorkspace))
                  .then((response: Array<DbDocument>) => {
                    response.forEach((a) => Helpers.checkDocumentValidity(a));
                    view.displayAllChannels(response);
                  })
                  .catch((error) => {
                    console.log(error);
                    view.displayError(error);
                  });
              });
          });
      },
    );
  }

  // Login() groups functions relating to the login process, handling tokens and the login event.
  function login() {
    // Occurs when the user attempts to log in.
    document.addEventListener(
      "loginEvent",
      function (evt: CustomEvent<LoginEvent>) {
        console.log("loginEvent", evt);
        slog.info("Login event called");
        writeModel
          .loginUser(evt.detail.url, evt.detail.username)
          .then((token) => {
            console.log("Token = " + token);
            let obj = JSON.parse(token);
            console.log("obj = " + obj);
            updateToken(token);
            handleWorkspaces();
            // Update the page to have the user and remove the login page
            view.removeLoginPage(evt.detail.username);
          })
          .catch((error) => {
            console.log(error);
            view.displayLoginError(error);
          });

        // Init the workspaces notification
      },
    );
  }

  // Logout() groups functions relating to the logout process.
  function logout() {
    // Occurs when the user attempts to logout.
    document.addEventListener(
      "logoutEvent",
      function (evt: CustomEvent<LogoutEvent>) {
        console.log("logoutEvent", evt);
        writeModel.logoutUser(evt.detail.url).catch((error) => {
          console.log(error);
          view.displayError(error);
        });
        location.reload();
      },
    );
  }

  /**
   * Get the token and store it for future use.
   * @param input the JSON object that stores the token
   */
  function updateToken(input: string): void {
    //token = input;
    let obj = JSON.parse(input);
    slog.info("Token: " + obj.token);
    localStorage.setItem("token", obj.token);
    console.log("global token is now: " + localStorage.getItem("token"));
  }
});
