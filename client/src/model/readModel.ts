import { DbDocument } from "../../types/dbdocument";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { Post } from "../../types/post";
import Helpers from "../helpers/helpers";

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
 * Model class that interfaces with the OWLDB network service in READs only.
 */
export class ReadModel {
  // Maybe Later private env: {
  DATABASE_HOST: string;
  DATABASE_PATH: string;
  AUTH_PATH: string;
  controller: AbortController;

  /**
   * Constructs a new read model.
   * @param host The host URL
   * @param path The path to the database that holds our messages
   * @param auth The authentication path
   */
  constructor(host: string, path: string, auth: string) {
    this.DATABASE_HOST = host;
    this.DATABASE_PATH = path;
    this.AUTH_PATH = auth;
    this.controller = new AbortController();
  }

  /**
   * Get all workspaces in the current database.
   * @returns a promise that resolves to an array of Document objects.
   */
  getWorkspaces(): Promise<Array<DbDocument>> {
    console.log("Getting workspaces...");
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    };

    return typedFetch<Array<DbDocument>>(
      this.DATABASE_HOST + this.DATABASE_PATH + "/",
      options,
    );
  }

  /**
   * Get all channels in current workspace.
   *
   * @returns a promise that resolves to an array of Document objects.
   */
  getChannels(workspace: string): Promise<Array<DbDocument>> {
    console.log("Getting Channel...");
    const options = {
      method: "GET",
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
   * Get all Posts in inputted workspace and channel.
   *
   * @returns a promise that resolves to an array of Document objects.
   */
  getPosts(workspace: string, channel: string): Promise<Array<Post>> {
    console.log("Getting Posts...");
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    };

    return typedFetch<Array<Post>>(
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
   * Subscribe to the posts collection associated with the channel.
   * @param workspace The workspace path to subscribe to.
   * @param channel the current channel
   */
  async openLiveEventStream(workspace: string, channel: string) {
    // Subscribe to the posts collection associated with the channel
    // Using the "AJV" package
    console.log("Attempting to subscribe to posts...");

    // End any previously started subscriptionstreams
    this.controller.abort();
    this.controller = new AbortController();

    const subURL =
      this.DATABASE_HOST +
      this.DATABASE_PATH +
      "/" +
      workspace +
      "/channels/" +
      channel +
      "/posts/" +
      "?mode=subscribe";

    await fetchEventSource(subURL, {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },

      // Any new updates to the post collection should create a "serverSideMessageEvent"
      onmessage(ev) {
        console.log("Received Event from SSE Stream:");
        console.log(ev);

        if (ev.event == "delete") {
          console.log("Error: Deleting posts not possible.");
          return;
        } else if (ev.event == "") {
          console.log("Received empty event. Stream still open.");

          // We should "add" the post from this to our channel
          const emptySSE = new CustomEvent("serverSideMessageEvent", {
            detail: { postContents: {} },
          });
          console.log("emptySSEEvent dispatched");
          document.dispatchEvent(emptySSE);

          return;
        }

        // Validate that the data is of the correct schema
        //  ev.event, data: ev.data, id: ev.id
        console.log("EVENT DATA:" + ev.data);
        const postData = JSON.parse(ev.data);
        Helpers.checkPostValidity(postData);

        const newPost = {
          path: postData.path,
          author: postData.meta.createdBy,
          creationTime: postData.meta.createdAt,
          contents: postData.doc.msg,
          parent: postData.doc.parent!,
          reactions: postData.doc.reactions,
          extensions: postData.doc.extensions,
        };

        // We should "add" the post from this to our channel
        const sseEvent = new CustomEvent("serverSideMessageEvent", {
          detail: { postContents: newPost },
        });

        console.log("sseEvent dispatched");
        document.dispatchEvent(sseEvent);
      },
      onerror(er) {
        console.log("ERROR with SSE stream:" + er);
      },

      /**
       * If any previous channel subscriptions are open, this should close them when the channel is closed.
       * Used when the user
       * (1) Opens another channel
       * (2) Opens another workspaces
       * (3) (?) Closes the application
       */
      signal: this.controller.signal,
    });
  }
}
