import { DbDocument } from "../../types/dbdocument";
import { PostItem } from "../main";

/**
 * Wrapper around fetch to return a Promise that resolves to the desired
 * type. This function does not validate whether the response actually
 * conforms to that type.
 *
 * @param url      url to fetch from
 * @param options  fetch options
 * @returns        a Promise that resolves to the unmarshaled JSON response
 * @throws         an error if the fetch fails, there is no response body,
 *                 or the response is not valid JSON
 */
function typedFetch<T>(url: string, options?: RequestInit): Promise<T> {
  console.log("Fetching at URL: " + url);
  console.log("Options body: " + options?.body);

  // Removed returning this as a string
  return fetch(url, options)
    .then((response: Response) => {
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      console.log("response = " + response);

      // Return decoded JSON if there is a response body or null otherwise
      // Type of unmarshaled response needs to be validated
      return response.json() as Promise<T>;
    })
    .catch((error) => {
      // Handle errors during JSON conversion here
      console.error("Error converting response to JSON:", error);
      throw error; // Re-throw the error to maintain the error chain
    });
}

/**
 * Wrapper around fetch to return a Promise that resolves when an empty
 * response is received.
 *
 * @param url      url to fetch from
 * @param options  fetch options
 * @returns        a Promise that resolves when an empty response is received
 * @throws         an error if the fetch fails or there is a response body,
 */
function emptyFetch(url: string, options?: RequestInit): Promise<void> {
  return fetch(url, options).then((response: Response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    } else {
      // No content
      return;
    }
  });
}

/**
 * Model class that interfaces with the OWLDB network by writing to it.
 */
export class WriteModel {
  DATABASE_HOST: string;
  DATABASE_PATH: string;
  AUTH_PATH: string;
  /**
   * Constructs a new write model.
   * @param host The host URL
   * @param path The path to the database that holds our messages
   * @param auth The authentication path
   */
  constructor(host: string, path: string, auth: string) {
    this.DATABASE_HOST = host;
    this.DATABASE_PATH = path;
    this.AUTH_PATH = auth;
  }

  /**
   * Puts the database in DATABASE_PATH if it does not already exist.
   *
   * @returns a promise that resolves to an array of Document objects.
   */
  putNewDatabase(): Promise<Array<DbDocument>> {
    console.log("Putting the new database...");
    const options = {
      method: "PUT",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    };

    return typedFetch<Array<DbDocument>>(
      this.DATABASE_HOST + this.DATABASE_PATH,
      options,
    );
  }

  /**
   * Put a new workspace in the database.
   *
   * @returns a promise that resolves to an array of Document objects.
   */
  putWorkspace(workspace: string): Promise<Array<DbDocument>> {
    console.log("Putting new workspace... " + workspace);
    // Each workspace is a document
    const options = {
      method: "PUT",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: "{}",
    };

    return typedFetch<Array<DbDocument>>(
      this.DATABASE_HOST + this.DATABASE_PATH + "/" + workspace,
      options,
    );
  }

  /**
   * Put a new channels collection in a new workspace.
   *
   * @returns a promise that resolves to an array of Document objects.
   */
  putWorkspaceChannels(workspace: string): Promise<Array<DbDocument>> {
    console.log("Putting channels collection into workspace: " + workspace);
    // Each workspace contains one collection called "channels"
    const options = {
      method: "PUT",
      headers: {
        accept: "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    };

    return typedFetch<Array<DbDocument>>(
      this.DATABASE_HOST + this.DATABASE_PATH + "/" + workspace + "/channels/",
      options,
    );
  }

  /**
   * Put a new channel in the current workspace.
   *
   * @returns a promise that resolves to an array of Document objects.
   */
  putChannel(
    workspace: string,
    newChannelName: string,
  ): Promise<Array<DbDocument>> {
    console.log("PUT on new channel: " + newChannelName);
    // Each channel is a document
    const options = {
      method: "PUT",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: "{}",
    };

    return typedFetch<Array<DbDocument>>(
      this.DATABASE_HOST +
        this.DATABASE_PATH +
        "/" +
        workspace +
        "/channels/" +
        newChannelName,
      options,
    );
  }

  /**
   * Put a new posts collection in a new workspace.
   *
   * @returns a promise that resolves to an array of Document objects.
   */
  putChannelPosts(
    workspace: string,
    channel: string,
  ): Promise<Array<DbDocument>> {
    console.log("Putting posts collection into workspace: " + workspace);
    // Each channel contains one collection called "posts"
    const options = {
      method: "PUT",
      headers: {
        accept: "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    };

    return typedFetch<Array<DbDocument>>(
      this.DATABASE_HOST +
        this.DATABASE_PATH +
        "/" +
        workspace +
        "/channels/" +
        channel +
        "/posts/",
      options,
    );
  }

  /**
   * Put a new message in the currently selected channel and workspaces.
   *
   * @returns http request
   */
  createPost(
    workspace: string,
    channel: string,
    inputPost: PostItem,
  ): Promise<DbDocument[]> {
    console.log(
      "Putting post in collection: " + channel + " with workspace " + workspace,
    );

    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({
        msg: inputPost.contents,
        parent: inputPost.parent,
        reactions: inputPost.reactions,
        extensions: inputPost.extensions,
      }),
    };

    return typedFetch<Array<DbDocument>>(
      this.DATABASE_HOST +
        this.DATABASE_PATH +
        "/" +
        workspace +
        "/channels/" +
        channel +
        "/posts/",
      options,
    );
  }

  /**
   * PATCH a new reaction in the post that the user has reacted to.
   *
   * @returns A promise of documents returning the results of a PATCH operation.
   */
  createReact(
    reactionType: string,
    targetPost: string,
    inputUser: string,
  ): Promise<DbDocument[]> {
    console.log("Patching react with path: " + targetPost);

    const options = {
      method: "PATCH",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify([
        {
          op: "ArrayAdd",
          path: "/reactions/" + reactionType,
          value: inputUser,
        },
      ]),
    };

    // TODO: We need to "objectAdd" the item to the object when it does not yet exist
    // but if it does already, we arrayAdd the user.

    return typedFetch<Array<DbDocument>>(
      this.DATABASE_HOST + this.DATABASE_PATH + targetPost,
      options,
    );
  }

  /**
   * Delete the given channel in the current workspace.
   *
   * @returns a promise that resolves to an array of Document objects.
   */
  deleteChannel(workspace: string, deleteChannel: string): Promise<void> {
    console.log("DELETE on channel: " + deleteChannel);
    const options = {
      method: "DELETE",
      headers: {
        accept: "*/*",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    };

    return emptyFetch(
      this.DATABASE_HOST +
        this.DATABASE_PATH +
        "/" +
        workspace +
        "/channels/" +
        deleteChannel,
      options,
    );
  }
  /**
   * Delete the given workspace.
   *
   * @returns a promise that resolves to an array of Document objects.
   */
  deleteWorkspace(workspace: string): Promise<void> {
    console.log("DELETE on workspace: " + workspace);
    const options = {
      method: "DELETE",
      headers: {
        accept: "*/*",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    };

    return emptyFetch(
      this.DATABASE_HOST + this.DATABASE_PATH + "/" + workspace,
      options,
    );
  }

  /**
   * Login with the given username.
   * @param url the url of the request
   * @param username the user's username
   * @returns a promise that resolves to a JSON object with a token.
   */
  loginUser(url: string, username: string): Promise<string> {
    const options = {
      method: "POST",
      body: `{"username": "${username}"}`,
      headers: { "Content-Type": "application/json" },
    };

    return typedFetch<string>(url, options)
      .then((response) => JSON.stringify(response))
      .catch((error) => {
        console.log("There was an issue getting the token!");
        throw error;
      });
  }

  /**
   * Logout the current user.
   * @param url the url of the request
   * @returns a promise that resolves to a string
   */
  logoutUser(url: string): Promise<string> {
    const options = {
      method: "DELETE",
      headers: {
        accept: "*/*",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    };
    console.log("logoutUser() called");

    return emptyFetch(url, options)
      .then((response) => JSON.stringify(response))
      .catch((error) => {
        console.log("There was an issue destroying the token!");
        throw error;
      });
  }
}
