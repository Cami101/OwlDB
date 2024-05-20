import { DbDocument } from "../types/dbdocument";
import { PostItem } from "./main";

// View Events
/**
 * Triggered when the user logs in.
 */
export type LoginEvent = {
  url: string;
  username: string;
};

/**
 * Triggered when the user creates a new channel
 */
export type CreateChannelEvent = {
  url: string;
  channel: string;
};

/**
 * Triggered when the user deletes a channel.
 */
export type DeleteChannelEvent = {
  channel: string;
};

/**
 * Triggered when the user creates a database.
 */
export type CreateDatabaseEvent = {
  url: string;
};

/**
 * Triggered when a user creates a workspace.
 */
export type CreateWorkspaceEvent = {
  workspace: string;
};

/**
 * Triggered when a user deletes a workspace.
 */
export type DeleteWorkspaceEvent = {
  workspace: string;
};

/**
 * Triggered when a user's logout has succeeded.
 */
export type LogoutEvent = {
  url: string;
};

/**
 * Triggered when the user logs in and workspaces should be accessed.
 */
export type InitWorkspacesEvent = {
  workspaces: Array<string>;
};

/**
 * Triggered whenever the user refreshes the workspace event.
 */
export type RefreshWorkspaceEvent = {
  id: string;
};

/**
 * Triggered whenever the user creates a post.
 */
export type PostCreatedEvent = {
  postData: PostItem;
};

/**
 * Triggered whenever the user reacts to a post.
 */
export type ReactionCreatedEvent = {
  reactionType: string;
  targetPost: string;
};

/**
 * Triggered whenever the user selects a workspace from the dropdown.
 */
export type WorkspaceChosenEvent = {
  currentWorkspace: string;
};

/**
 * Triggered whenever the user schedule sends a post.
 */
export type PostScheduleSent = {
  newPost: PostItem;
};

/**
 * Triggered whenever the user selects a channel.
 */
export type ChannelSelectedEvent = {
  currentChannel: string;
};

/**
 * Triggered whenever the user clicks the refresh channel button.
 */
export type RefreshChannelsButtonEvent = {
  id: string;
};

/**
 * Triggered whenever the user refreshes the channels from the menu.
 */
export type RefreshChannelsEvent = {
  id: string;
};

/**
 * Triggered whenever the server notifies us of a server side message.
 */
export type ServerSideMessageEvent = {
  postContents: PostItem;
};

/**
 * Triggered whenever the server gets posts and alerts the channel.
 */
export type PostsLoadedEvent = {
  postList: Array<PostItem>;
};

/**
 * Triggered whenever the user replies to a  message.
 */
export type ReplyingToMessageEvent = {
  replyTarget: string;
};

/**
 * Triggered whenever the user submits a reply to a message.
 */
export type ClearReplyBox = {
  targetMessage: string;
};

// Declare our events to change view attributes in the model here.
declare global {
  interface DocumentEventMap {
    loginEvent: CustomEvent<LoginEvent>;
    logoutEvent: CustomEvent<LogoutEvent>;
    workspaceChosenEvent: CustomEvent<WorkspaceChosenEvent>;
    initWorkspacesEvent: CustomEvent<InitWorkspacesEvent>;
    refreshWorkspacesEvent: CustomEvent<RefreshWorkspaceEvent>;
    channelSelectedEvent: CustomEvent<ChannelSelectedEvent>;
    refreshChannelsEvent: CustomEvent<RefreshChannelsEvent>;
    serverSideMessageEvent: CustomEvent<ServerSideMessageEvent>;
    postCreatedEvent: CustomEvent<PostCreatedEvent>;
    postsLoadedEvent: CustomEvent<PostsLoadedEvent>;
    reactionCreatedEvent: CustomEvent<ReactionCreatedEvent>;
    replyingToMessageEvent: CustomEvent<ReplyingToMessageEvent>;
    postScheduleSent: CustomEvent<PostScheduleSent>;
    clearReplyBox: CustomEvent<ClearReplyBox>;
    createChannelEvent: CustomEvent<CreateChannelEvent>;
    createDatabaseEvent: CustomEvent<CreateDatabaseEvent>;
    deleteChannelEvent: CustomEvent<DeleteChannelEvent>;
    refreshChannelsButtonEvent: CustomEvent<RefreshChannelsButtonEvent>;
  }
}

/*
 * The view class manages the components of the UI displayed to the user.
 */
export class View {
  private _login: HTMLButtonElement | null = null;
  private _logout: HTMLButtonElement | null = null;
  // private _form: HTMLElement | null = null;
  private _channelList: HTMLFieldSetElement | null = null;
  private _loginForm: HTMLElement | null = null;
  private _createChannel: HTMLButtonElement | null = null;
  private _deleteChannel: HTMLButtonElement | null = null;
  private _refreshChannel: HTMLButtonElement | null = null;

  constructor() {
    const login = document.querySelector("#submit-user");
    const channelList = document.querySelector("#channel-list");
    const loginForm = document.querySelector("#login-form");
    const logout = document.querySelector("#logout");
    const createChannel = document.querySelector("#create-channel");
    const deleteChannel = document.querySelector("#delete-channel");
    const refreshChannel = document.querySelector("#refresh-channel");

    // Verify that each of our HTML elements are what we expect them to be
    if (!(login instanceof HTMLButtonElement)) {
      console.log("Error: #submit-user is not a button:", login);
      return;
    }

    if (!(logout instanceof HTMLButtonElement)) {
      console.log("Error: #logout is not a button:", logout);
      return;
    }

    if (!(channelList instanceof HTMLFieldSetElement)) {
      console.log(
        "Error: #channel-list is not an HTML Fieldset Element:",
        channelList,
      );
      return;
    }

    if (!(loginForm instanceof HTMLElement)) {
      console.log("Error: #login-form is not an HTML Element:", loginForm);
      return;
    }

    if (!(createChannel instanceof HTMLButtonElement)) {
      console.log("Error: #create-channel is not a button:", createChannel);
      return;
    }

    if (!(deleteChannel instanceof HTMLButtonElement)) {
      console.log("Error: #delete-channel is not a button:", deleteChannel);
      return;
    }

    if (!(refreshChannel instanceof HTMLButtonElement)) {
      console.log("Error: #refresh-channel is not a button:", refreshChannel);
      return;
    }

    this._login = login;
    // this._form = form;
    this._channelList = channelList;
    this._loginForm = loginForm;
    this._logout = logout;
    this._createChannel = createChannel;
    this._deleteChannel = deleteChannel;
    this._refreshChannel = refreshChannel;

    // Handler for creating new logins.
    this._login.addEventListener("click", (event) => {
      console.log("Login button clicked");
      // Stop the browser from trying to "submit" the login.
      event.preventDefault();

      const username = (<HTMLInputElement>document.getElementById("username"))
        ?.value;

      console.log("username: " + username);

      // Pass the login event to main, to get the workspaces available.
      const loginEvent = new CustomEvent("loginEvent", {
        detail: {
          username: username,
          url: process.env.DATABASE_HOST + "/" + process.env.AUTH_PATH,
        },
      });

      // Login notification sent out.
      document.dispatchEvent(loginEvent);
    });

    // Handler for creating new logouts.
    this._logout.addEventListener("click", (event) => {
      // Clear the current workspace selection
      const workspace = document.getElementById("currentWorkspace");
      if (workspace) {
        workspace.textContent = "";
      }
      // Pass the logout event to main, to delete the old token
      const logoutEvent = new CustomEvent("logoutEvent", {
        detail: {
          url: process.env.DATABASE_HOST + "/" + process.env.AUTH_PATH,
        },
      });

      // Clear the channel display

      // Logout notification sent out.
      document.dispatchEvent(logoutEvent);

      // Pop the login modal back up so another user can log in.
      this.popupLoginPage();
    });

    // Handler for creating new channels.
    this._createChannel.addEventListener("click", (event) => {
      console.log("Create channel button clicked!");

      // Get the new channel's name
      const textInput = document.getElementById("new-channel");
      const newChannelName = (<HTMLInputElement>textInput)?.value;
      if (newChannelName == "") {
        this.displayError(
          "Attempted to make a channel with no name. Try again with a non-empty name.",
        );
        console.log(
          "Attempted to make a channel with no name. Try again with a non-empty name.",
        );
        return;
      }
      console.log("New channel's name is " + newChannelName);

      const channels = document.querySelectorAll("input[type='radio']");

      if (channels === undefined) {
        throw new Error("Radio buttons not found");
      }

      let channelFound;
      for (let idx = 0; idx < channels.length; idx++) {
        const selection = channels[idx];
        if (selection instanceof HTMLInputElement) {
          channelFound = selection.value;
          // console.log("Channel Found: " + channelFound);
          if (channelFound === newChannelName) {
            this.displayError(
              "Another channel already has the name '" +
                newChannelName +
                "', please choose another name. ",
            );
            console.log("Duplicate channel attempted to be made");
            return;
          }
        }
      }

      // Clear the text input
      if (textInput) {
        (<HTMLInputElement>textInput).value = "";
      }

      // Pass the create channel event to main
      const createChannelEvent = new CustomEvent("createChannelEvent", {
        detail: {
          url: process.env.DATABASE_HOST + "/" + process.env.AUTH_PATH,
          channel: newChannelName,
        },
      });

      // Create channel notification sent out.
      document.dispatchEvent(createChannelEvent);
    });

    // Handler for deleting channels.
    this._deleteChannel.addEventListener("click", (event) => {
      console.log("Delete channel button clicked!");

      // Get the currently selected channel
      const checkedChannel = document.querySelectorAll(
        "input[type='radio']:checked",
      );

      if (checkedChannel === undefined) {
        throw new Error("Radio buttons not found");
      }

      let channelFound;
      for (let idx = 0; idx < checkedChannel.length; idx++) {
        const selection = checkedChannel[idx];
        if (selection instanceof HTMLInputElement) {
          channelFound = selection.value;
          console.log(`Channel currently selected: ${channelFound}`);
        }
      }

      if (channelFound === undefined) {
        this.displayError("No channel is selected. Please select a channel.");
        console.log("No channel is selected. Please select a channel.");
        return;
      }

      // Pass the delete channel event to main
      const deleteChannelEvent = new CustomEvent("deleteChannelEvent", {
        detail: {
          url: process.env.DATABASE_HOST + "/" + process.env.AUTH_PATH,
          channel: channelFound,
        },
      });

      // Delete channel notification sent out.
      document.dispatchEvent(deleteChannelEvent);

      // todo: update the channel display to be empty again
      // <article id="default-no-posts" class=""> Waiting for posts.... </article>
    });

    // Handler for refreshing channels.
    this._refreshChannel.addEventListener("click", (event) => {
      console.log("Refreshing channels....");
      // Pass the refresh channel event to main
      const refreshChannelsButtonEvent = new CustomEvent(
        "refreshChannelsButtonEvent",
        {
          detail: {
            id: "Refresh channel button was clicked",
          },
        },
      );

      // Refresh channel notification sent out.
      document.dispatchEvent(refreshChannelsButtonEvent);
    });
  }

  /**
   * Display all the current workspace's channels (and remove any others).
   *
   * @param channels array of Channel Names to display
   */
  displayAllChannels(channels: Array<DbDocument>): void {
    // Remove all Channels and update view. A better implementation would
    // only add/remove Channels that are new or deleted from what is currently
    // there.
    if (this._channelList) {
      this._channelList.innerHTML = "";
    }

    console.log("Loading channels...");

    channels.forEach((currChannel: DbDocument) => {
      const buttonGroup = document.createElement("label");
      const chanName = currChannel.path.substring(
        currChannel.path.lastIndexOf("/") + 1,
      );
      const channelItem = document.createElement("input");
      channelItem.setAttribute("type", "radio");
      channelItem.setAttribute("name", "channel-button");
      channelItem.value = chanName;

      buttonGroup.appendChild(channelItem);
      buttonGroup.innerHTML += "<span> " + chanName + "</span><br>";

      this._channelList?.appendChild(buttonGroup);
    });

    // Checks when the user has selected a channel from available ones.
    this._channelList?.addEventListener("click", (event) => {
      const refreshChannelsEvent = new CustomEvent("refreshChannelsEvent", {
        detail: { id: "Initial load" },
      });
      console.log("refreshChannelEvent dispatched from view.ts");
      document.dispatchEvent(refreshChannelsEvent);
    });
  }

  /**
   * Iterates through the radio buttons and finds the selected channel.
   * @returns the name of the current channel, "" if none selected
   */
  getChannel(): string {
    const checkedChannel = document.querySelectorAll(
      "input[type='radio']:checked",
    );

    if (checkedChannel === undefined) {
      throw new Error("Radio buttons not found");
    }

    let channelFound;
    for (let idx = 0; idx < checkedChannel.length; idx++) {
      const selection = checkedChannel[idx];
      if (selection instanceof HTMLInputElement) {
        channelFound = selection.value;
        return channelFound;
      }
    }
    return "";
  }

  /**
   * Refreshes the channel
   */
  refreshChannel() {
    // Stop the browser from trying to "submit" the login.
    console.log("Channel List Clicked");

    const channelFound = this.getChannel();

    if (channelFound != "") {
      // Dispatch event when correct box chosen
      console.log(`Channel Chosen: ${channelFound}`);

      const channelChosen = new CustomEvent("channelSelectedEvent", {
        detail: { currentChannel: channelFound },
      });

      // Alert main that a new channel has been selected.
      document.dispatchEvent(channelChosen);
    }
  }

  /**
   * Refreshes the channel list for the current workspace
   */
  refreshChannels() {
    // Stop the browser from trying to "submit" the login.
    console.log("Channel List Clicked");

    const channelFound = this.getChannel();

    if (channelFound != "") {
      // Dispatch event when correct box chosen
      console.log(`Channel Chosen: ${channelFound}`);

      const channelChosen = new CustomEvent("channelSelectedEvent", {
        detail: { currentChannel: channelFound },
      });

      // Alert main that a new channel has been selected.
      document.dispatchEvent(channelChosen);
    }
  }

  /**
   * Edits the display in the corner to have the wsName
   * @param wsName  the name of the current workspace
   */
  displayCurrWorkspace(wsName: string) {
    // Update the page to have the workspace displayed
    const workspace = document.getElementById("currentWorkspace");
    if (workspace) {
      workspace.textContent = wsName;
    }
  }

  /**
   * Remove modal pop-up after successful login
   * and update the page to have the successfully logged in username
   * @param username the username of the logged in user
   */
  removeLoginPage(username: string) {
    // Update the page to have the successfully logged in user
    const usernameDisplay = document.getElementById("loginUserName");
    if (usernameDisplay) {
      usernameDisplay.textContent = username;
    }

    // Remove form after submit is clicked
    console.log(this._loginForm);
    this._loginForm?.remove();
    console.log("removed login page");
  }

  /**
   * Reappear modal pop-up after successful logout
   * and update the page to remove logged in username
   */
  popupLoginPage() {
    // Remove the username in the corner
    const usernameDisplay = document.getElementById("loginUserName");
    if (usernameDisplay) {
      usernameDisplay.textContent = "";
    }

    // Rebuild the login modal
    const loginForm = document.createElement("article");
    loginForm.id = "login-form";
    loginForm.classList.add("modal");
    const innerLoginContent = document.createElement("article");
    innerLoginContent.classList.add("modal-content");
    innerLoginContent.id = "inner-login-content";
    const header = document.createElement("h2");
    header.innerHTML = "Login";
    innerLoginContent.appendChild(header);
    const input = document.createElement("input");
    input.type = "text";
    input.id = "username";
    input.placeholder = "Username";
    innerLoginContent.appendChild(input);
    const button = document.createElement("button");
    button.id = "submit-user";
    button.innerHTML = "Submit";
    innerLoginContent.appendChild(button);
    loginForm.appendChild(innerLoginContent);
    console.log(loginForm);
    document.body.appendChild(loginForm);

    // Reset the variable names to the new modal
    this._loginForm = loginForm;
    this._login = button;
    // this._form = input;

    // TODO: Remove duplicate code.
    // Reset the event listener
    this._login.addEventListener("click", (event) => {
      console.log("Login button clicked");
      // Stop the browser from trying to "submit" the login.
      event.preventDefault();

      const username = (<HTMLInputElement>document.getElementById("username"))
        ?.value;

      console.log("username: " + username);

      // Pass the login event to main, to get the workspaces available.
      const loginEvent = new CustomEvent("loginEvent", {
        detail: {
          username: username,
          url: process.env.DATABASE_HOST + "/" + process.env.AUTH_PATH,
        },
      });

      // Login notification sent out.
      document.dispatchEvent(loginEvent);
    });
    console.log("Popped up login page");
  }

  /**
   * Display an error message to the user
   *
   * @param error error message to display
   */
  displayError(error: string): void {
    const errorPopup = document.createElement("article");
    errorPopup.id = "error-display";
    errorPopup.classList.add("modal");
    const innerContent = document.createElement("article");
    innerContent.classList.add("modal-content");
    innerContent.id = "inner-err-content";
    const header = document.createElement("h2");
    header.innerHTML = error;
    innerContent.appendChild(header);
    const button = document.createElement("button");
    button.id = "error-accept";
    button.innerHTML = "Ok";
    innerContent.appendChild(button);
    errorPopup.appendChild(innerContent);
    console.log("error displayed");
    document.body.appendChild(errorPopup);

    button.addEventListener("click", (event) => {
      console.log("Accepted the error!");
      errorPopup.remove();
    });
  }

  /**
   * Display an error message to the user
   *
   * @param error error message to display
   */
  displayLoginError(error: string): void {
    document.querySelector("#login-error-msg")?.remove();
    console.log("displayLoginError received a error message: " + error);
    const para = document.createElement("p");
    const node = document.createTextNode(error);
    para.id = "login-error-msg";
    para.append(node);
    const innerLoginContent = document.querySelector("#inner-login-content");
    innerLoginContent?.appendChild(para);
  }

  /**
   * Reset the list of channels to have no channels and
   * prompt the user to select a workspace.
   */
  resetChannelDisplay(): void {
    const channelList = document.querySelector("#channel-list");
    if (channelList) channelList.innerHTML = "Select a workspace!";
  }
}
