/* A web component to gather user input */
import { extensionData, PostItem } from "../main";
import Helpers from "../helpers/helpers";

/* A web component to display posts within a channel */
class ChannelDisplay extends HTMLElement {
  // Maps the encoded post's path -> the ID of the post.
  private postIDMap: Map<string, string> = new Map<string, string>();

  // Stores posts that do not yet have their parent on the screen yet.
  // Maps the Parent's name -> the PostItem object.
  private pendingPostQueue: Map<string, PostItem[]> = new Map<
    string,
    PostItem[]
  >();

  // The scheduledPosts queue represents all posts scheduled but not yet sent.
  private scheduledPosts: Array<PostItem> = new Array<PostItem>();

  // An array of sorted posts currently on the page
  private currentPosts: Array<PostItem> = new Array<PostItem>();

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    /**
     *  Tells our channel display when new posts have loaded, and updates the view.
     */
    document.addEventListener("postsLoadedEvent", (e: Event) => {
      if (!Helpers.isCustomEvent(e))
        throw new Error("Error! Channel event type incorrect.");

      this.postIDMap = new Map<string, string>();
      this.currentPosts = new Array<PostItem>();
      this.pendingPostQueue = new Map<string, PostItem[]>();

      console.log("posts up!");

      if (this.shadowRoot) {
        this.shadowRoot.innerHTML = `
        <style>
            .post-list {
            list-style-type: none;
            padding-left: 1.25rem; /* Indent nested lists */
            }
            .post {
                margin-bottom: 0.625rem;
                padding: 0.625rem;
                background-color: #f5f5f5;
                border-left: 0.188rem solid #333;
                /*cursor: pointer;*/
            }
           .post:hover {
             background-color: #eaeaea;
            }
            .post-text {
                color:black;
            }
            .reaction-btn {
              color: white;
              background-color: seagreen;
              padding: 0.25rem;
              margin: 0.30rem;
              border: 1rem;
              border-color: black;
              border-radius: 0.2rem;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.063rem;
            }
            .reply-btn {
            font-size: 1rem;
            background: dodgerblue;
            float: right;
            border: 0.1rem;
            border-color: black;
            border-radius: 0.2rem;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.063rem;
            cursor: pointer;
            }
            .reply-btn:hover {
            background: blue;
            }
            .react-btn {
            font-size: 1rem;
            background: lawngreen;
            float: right;
            border: 0.1rem;
            border-color: black;  
            border-radius: 0.2rem;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.063rem;
            cursor: pointer;
            }
            .react-btn:hover{
            background: green;
            }
            .react-btn:hover + .menu {
                display: block;
                color: red;
            }
            .reply-popup {
            background: lightgray;
            border: none;
            border-radius: 0.2rem;
            padding: 0.5rem;
            }
            .close-reply: {
            float: right;
            border: none;
            border-radius: 0.2rem;
            }
            .close-reply:hover {
            background-color: red;
            }
        </style>
      `;
      }

      // Now, we know if "e" is of the correct event type.
      console.log("postsLoadedEvent", e);
      this.initChannel();
    });

    // When a reply is successfully submitted, we remove the message box associated with it.
    document.addEventListener("clearReplyBox", (e: Event) => {
      const oldReplyBoxes =
        this.shadowRoot?.querySelectorAll("#curr-reply-box");
      console.log("CLEARING: clearReplyBox Event");
      console.log(oldReplyBoxes);

      oldReplyBoxes?.forEach((someBox) => {
        someBox.remove();
      });

      const clearReplyEvent = new CustomEvent("replyingToMessageEvent", {
        detail: { replyTarget: "" },
      });
      console.log("clearReplyEvent dispatched");
      document.dispatchEvent(clearReplyEvent);

      const bottomReplyBox = document.querySelector("#msg-box") as HTMLElement;
      bottomReplyBox!.hidden = false;
      return;
    });
  }

  connectedCallback(): void {
    this.initSSEMessages();
    this.clear();
  }

  clear(): void {
    if (this.shadowRoot) {
      // This could also come from an HTML template
      this.shadowRoot.innerHTML = `
        <style>
            .post-list {
            list-style-type: none;
            padding-left: 1.25rem; /* Indent nested lists */
            }
            .post {
                margin-bottom: 0.625rem;
                padding: 0.625rem;
                background-color: #f5f5f5;
                border-left: 0.188rem solid #333;
                /*cursor: pointer;*/
            }
           .post:hover {
             background-color: #eaeaea;
            }
            .post-text {
                color:black;
            }
            .reaction-btn {
              color: white;
              background-color: #969b96;
              padding: 0.25rem;
              margin: 0.30rem;
              border: none;
              border-radius: 0.2rem;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.063rem;
            }
        </style>
        <article id="default-no-posts" class=""> Waiting for posts.... </article>
      `;
    } else {
      throw new Error("shadowRoot does not exist");
    }

    // Updates the channel display after a channel has been deleted
    document.addEventListener("deleteChannelEvent", (e: Event) => {
      console.log(
        "In channel, received a deleteChannelEvent, let's reset the posts display",
      );
      this.clear();
      const defaultExists = this.shadowRoot?.querySelector("#default-no-posts");
      defaultExists?.remove();
      const defaultNoPosts = document.createElement("article");
      defaultNoPosts.id = "default-no-posts";
      defaultNoPosts.innerHTML =
        "No channel selected. Select a channel to see posts...";
      this.shadowRoot?.appendChild(defaultNoPosts);
    });

    // Updates the channel display after a workspace has been selected
    document.addEventListener("workspaceChosenEvent", (e: Event) => {
      console.log(
        "In channel, received a workspaceChosenEvent, let's reset the posts display",
      );
      this.clear();
      const defaultExists = this.shadowRoot?.querySelector("#default-no-posts");
      defaultExists?.remove();
      const defaultNoPosts = document.createElement("article");
      defaultNoPosts.id = "default-no-posts";
      defaultNoPosts.innerHTML =
        "No channel selected. Select a channel to see posts...";
      this.shadowRoot?.appendChild(defaultNoPosts);
    });
    // Updates the channel display after a logout event
    document.addEventListener("logoutEvent", (e: Event) => {
      console.log(
        "In channel, received a LogoutEvent, let's reset the posts display",
      );
      this.clear();
      const defaultExists = this.shadowRoot?.querySelector("#default-no-posts");
      defaultExists?.remove();
      const defaultNoPosts = document.createElement("article");
      defaultNoPosts.id = "default-no-posts";
      defaultNoPosts.innerHTML =
        "No channel selected. Select a channel to see posts...";
      this.shadowRoot?.appendChild(defaultNoPosts);

      const channelList = document.querySelector("#channel-list");
      if (channelList) channelList.innerHTML = "Select a workspace!";
    });

    // When a workspace is created, reset the channel display
    document.addEventListener("createWorkspaceEvent", (e: Event) => {
      console.log(
        "In channel, received a createWorkspaceEvent, let's reset the posts display",
      );
      this.clear();
      const defaultExists = this.shadowRoot?.querySelector("#default-no-posts");
      defaultExists?.remove();
      const defaultNoPosts = document.createElement("article");
      defaultNoPosts.id = "default-no-posts";
      defaultNoPosts.innerHTML =
        "No workspace selected. Select a workspace to see posts...";
      this.shadowRoot?.appendChild(defaultNoPosts);
      const currWs = document.querySelector("#currentWorkspace") as HTMLElement;
      console.log(currWs);
      currWs!.innerHTML = "";
      const channelList = document.querySelector("#channel-list");
      if (channelList) channelList.innerHTML = "Select a workspace!";
    });

    // When a workspace is deleted, reset the channel display
    document.addEventListener("deleteWorkspaceEvent", (e: Event) => {
      console.log(
        "In channel, received a deleteWorkspaceEvent, let's reset the posts display",
      );
      this.clear();
      const defaultExists = this.shadowRoot?.querySelector("#default-no-posts");
      defaultExists?.remove();
      const defaultNoPosts = document.createElement("article");
      defaultNoPosts.id = "default-no-posts";
      defaultNoPosts.innerHTML =
        "No workspace selected. Select a workspace to see posts...";
      this.shadowRoot?.appendChild(defaultNoPosts);
      const currWs = document.querySelector("#currentWorkspace") as HTMLElement;
      console.log(currWs);
      currWs!.innerHTML = "";
      const channelList = document.querySelector("#channel-list");
      if (channelList) channelList.innerHTML = "Select a workspace!";
    });
  }
  /**
   * Initialize the channel's post group.
   */
  private initChannel() {
    const postGroup = document.createElement("ul");
    postGroup.classList.add("post-list");
    postGroup.id = "channel-post-list";

    this.shadowRoot?.append(postGroup);
  }

  /**
   * Adds post to the channel's post group.
   * @param post a post that has newly been created
   * @returns
   */
  private addPostToChannel(post: PostItem) {
    // Iteratively nests messages within other messages
    if (post.parent != undefined && post.parent != "") {
      // True if the post's parent is on the screen
      const parentKey = this.postIDMap.get(encodeURI(post.parent));
      console.log("ParentKey: " + parentKey);

      if (parentKey) {
        // NOT this.postIDMap.has(encodeURI(post.parent))
        if (this.shadowRoot?.getElementById(parentKey) != undefined) {
          console.log("child post started");
          // this.addPendingChildPost(post);
          this.addChildPost(post);
        } else {
          this.addPendingChildPost(post); // TODO: REMOVE IM GUESSING
          this.addPostToQueue(post.parent, post);
        }
      } else {
        // this.addPendingChildPost(post);
        // If the post's parent is NOT on the screen, we add it to the queue
        this.addPostToQueue(post.parent, post);
      }
    } else {
      // If the post has no parent, we add it to the channel.
      this.addParentPost(post);
    }

    // If the post that has been added is the parent of any posts in the queue,
    if (this.pendingPostQueue.has(post.path)) {
      console.log("Clearing post queue:");
      console.log(this.pendingPostQueue);

      const newChildList = this.pendingPostQueue.get(post.path);

      if (newChildList == undefined) {
        console.log("Error: Child of current post in map, but not found");
        return;
      }

      newChildList.sort((postA, postB) =>
        postA.creationTime < postB.creationTime ? -1 : 1,
      );

      newChildList?.forEach((newChild) => {
        this.addPostToChannel(newChild);
        this.pendingPostQueue.delete(post.path);
      });
    }
  }
  /**
   * Updates post's reactions, if there are any.
   * @param post a post that has been reacted to
   * @returns
   */
  private updatePost(post: PostItem) {
    // Find the post item that the post is referring to,
    // Remove it, and create a new element in its place

    const oldElemPath = this.postIDMap.get(encodeURI(post.path));

    if (oldElemPath == undefined) {
      console.log("Post path not found in PATCH operation");
      // alert("Post path not found in PATCH operation");
      return;
    }

    const oldPost = this.shadowRoot?.getElementById(oldElemPath);

    if (oldPost == null) {
      console.log("Post HTML not found in PATCH operation");
      // alert("Post HTML not found in PATCH operation");
      return;
    }

    // Update reactions if there are any
    if (post.reactions != undefined) {
      // const buttonPath = `#${oldElemPath} :scope > .reaction-btn`;
      const buttonPath = `#${oldElemPath} .reaction-btn`;
      const postReacts = oldPost.querySelectorAll(buttonPath);

      console.log("new reactions found: " + postReacts.length);
      console.log(postReacts);
      postReacts.forEach((someReact) => {
        if (!(someReact instanceof HTMLButtonElement)) {
          console.log(
            "Error: #reaction-btn selector is not recognized:",
            someReact,
          );
          return;
        }

        // We only remove reactions from the top level post:
        if (oldPost.contains(someReact) && someReact.parentNode == oldPost) {
          someReact.remove();
        }
      });

      // Adds each reaction in the map to the post.
      for (const [k, v] of Object.entries(post.reactions)) {
        const numReactors: number = v.length;

        if (numReactors != 0) {
          const emojiReaction = this.generateReaction(k, numReactors);
          if (emojiReaction != "") {
            oldPost.append(emojiReaction);
          }
        }
      }
    }
  }
  /**
   * Adds mappedPost to the queue of posts.
   * @param parentPath the path of the parent post
   * @param mappedPost post to be added
   */
  private addPostToQueue(parentPath: string, mappedPost: PostItem) {
    if (!this.pendingPostQueue.has(parentPath)) {
      this.pendingPostQueue.set(parentPath, []);
    }
    this.pendingPostQueue.get(parentPath)?.push(mappedPost);
  }

  /**
   * Adds the post to our channel display, maintaining the order in time.
   * @param post a post in our channel
   * @private
   */
  private addParentPost(post: PostItem) {
    // In the scenario in which we add this to the end
    const postGroup = this.shadowRoot?.getElementById("channel-post-list");
    if (!(postGroup instanceof HTMLUListElement)) {
      console.log("postGroup not of type HTMLUListElement");
      throw new Error("postGroup not of type HTMLUListElement");
    }

    const postElement = this.makePostElement(post);

    // We iterate through the posts until we find another post B such that A's time < B's time
    // and B's time is the minimal possible one.

    console.log("Parent post created");
    console.log(this.currentPosts);

    // TODO: Could change to binary search for efficiency
    // Iterates through posts until one with correct time stamp is found.
    for (let idx = 0; idx < this.currentPosts.length; idx++) {
      const comparedPost = this.currentPosts[idx];

      // Array is ordered
      if (post.creationTime < comparedPost.creationTime) {
        const nextPostPath = this.postIDMap.get(encodeURI(comparedPost.path));

        if (nextPostPath == undefined) {
          // This should never happen...
          console.log("ERROR! Next post ID not found in postID Map");
          alert("ERROR! Next post ID not found in postID Map");
          return;
        }

        const nodeAfter = this.shadowRoot?.getElementById(nextPostPath);

        if (nodeAfter == undefined || !(nodeAfter instanceof HTMLLIElement)) {
          // This should also never happen...
          console.log("ERROR! Next post node not found in postID Map");
          alert("ERROR! Next post node not found in postID Map");
          return;
        }

        postGroup.insertBefore(postElement, nodeAfter);
        this.currentPosts.splice(idx, 0, post);
        console.log(this.currentPosts);
        return;
      }
    }

    postGroup.appendChild(postElement);
    this.currentPosts.push(post);
    console.log(this.currentPosts);
  }

  /**
   * Adds post as a child to the channel display.
   * @param post a child post
   */
  private addChildPost(post: PostItem) {
    const postElement = this.makePostElement(post);

    const parentID = this.postIDMap.get(encodeURI(post.parent));

    if (parentID == undefined) {
      console.log("Error getting parent for child post");
      alert("Error getting parent for child post");
      throw new Error("Error getting parent for child post");
    }

    const parentNode = this.shadowRoot?.getElementById(parentID);

    if (!(parentNode instanceof HTMLLIElement)) {
      console.log(parentID);
      console.log(this.pendingPostQueue);
      console.log("Error: #parentnode is not an HTMLLI Element:", parentNode);
      console.log(parentID);
      throw new Error("Error: #parentnode is not an HTMLLI Element:");
    }

    let idx = 0;
    // Find the index of where the parent post should go,
    for (idx; idx < this.currentPosts.length; idx++) {
      // Array is ordered by creation time
      if (post.creationTime < this.currentPosts[idx].creationTime) {
        this.currentPosts.splice(idx, 0, post);
        break;
      }
    }

    parentNode?.append(postElement);
  }
  /**
   * Adds post to the queue.
   * @param post a child post that is pending
   * @private
   */
  private addPendingChildPost(post: PostItem) {
    if (this.pendingPostQueue.has(post.path)) {
      const postElement = this.makePostElement(post);

      const parentID = this.postIDMap.get(encodeURI(post.parent));

      if (parentID == undefined) {
        console.log("Error getting parent for pending child post");
        alert("Error getting parent for pending child post");
        throw new Error("Error getting parent for pending child post");
      }

      const parentNode = this.shadowRoot?.getElementById(parentID);

      if (!(parentNode instanceof HTMLLIElement)) {
        console.log(parentID);
        console.log(this.shadowRoot);
        console.log(document);
        console.log(this.postIDMap);
        console.log(this.pendingPostQueue);
        console.log("Error: #parentnode is not an HTMLLI Element:", parentNode);
        console.log(parentID);
        throw new Error("Error: #parentnode is not an HTMLLI Element:");
      }

      const childList = this.pendingPostQueue.get(post.path);

      if (childList == undefined) {
        throw new Error("Error: Child List Not Found");
      }

      childList.sort((postA, postB) =>
        postA.creationTime < postB.creationTime ? -1 : 1,
      );

      let idx = 0;
      // Find the index of where the parent post should go,
      for (idx; idx < this.currentPosts.length; idx++) {
        // Array is ordered by creation time
        if (post.creationTime < this.currentPosts[idx].creationTime) {
          this.currentPosts.splice(idx, 0, post);
          break;
        }
      }
      // We also have to add every child to the array in order, after the parent node
      childList?.forEach((child) => {
        postElement.appendChild(this.makePostElement(child));

        idx += 1;
        this.currentPosts.splice(idx, 0, child);
      });

      parentNode?.append(postElement);
      this.pendingPostQueue.delete(post.parent);
    }
  }

  /**
   * Creates messages in the channel's shadow DOM based on passed event containing posts in DB.
   * @param posts The array of Post objects queried from the model and parsed in main.
   * @private Used only to modify the shadow DOM within this function.
   */
  private makePostElement(post: PostItem) {
    // Generate a string to associate the post with, and create the post element
    const newID = this.generateRandomString(10);
    this.postIDMap.set(encodeURI(post.path), newID);

    const postItem = document.createElement("li");
    postItem.classList.add("post");
    postItem.textContent = `${post.author} @ ${this.parseDate(
      new Date(post.creationTime),
    )}`;

    postItem.id = newID;

    const replyIcon = document.createElement("button");
    replyIcon.classList.add("reply-btn");
    replyIcon.title = "Reply Button";
    replyIcon.innerHTML = `&#x2807`;
    replyIcon.id = "reply-" + post.path;

    // Adds a listener that is triggered upon the click of a reply button
    this.createReplyListener(replyIcon, newID);

    postItem.append(replyIcon);
    postItem.append(this.appendReactions(post));
    postItem.append(this.appendPostFormat(post));

    // Add associated reactions if the post has any.
    if (post.reactions != undefined) {
      // Adds each reaction in the map to the post.
      for (const [k, v] of Object.entries(post.reactions)) {
        const numReactors: number = v.length;

        if (numReactors != 0) {
          const emojiReaction = this.generateReaction(k, numReactors);
          if (emojiReaction != "") {
            postItem.append(emojiReaction);
          }
        }
      }
    }

    return postItem;
  }
  /**
   * Creates an event listener for clicking the reply button that pops
   * up the message box under the parent.
   * @param inputReply the reply button
   * @param postID the ID of the parent post
   */
  private createReplyListener(inputReply: HTMLButtonElement, postID: string) {
    inputReply.addEventListener("click", () => {
      console.log("Post reply button clicked");
      const userReplied = inputReply.id;
      const oldReplyBox = this.shadowRoot?.querySelector("#curr-reply-box");
      if (oldReplyBox != null) {
        oldReplyBox.remove();

        const clearReplyEvent = new CustomEvent("replyingToMessageEvent", {
          detail: { replyTarget: "" },
        });
        console.log("clearReplyEvent dispatched");
        document.dispatchEvent(clearReplyEvent);
        const bottomReplyBox = document.querySelector(
          "#msg-box",
        ) as HTMLElement;
        bottomReplyBox!.hidden = false;
        return;
      }

      // Make the box popup at the msg
      const msg = document.createElement("message-box");
      msg.id = "curr-reply-box";
      const replyMsg = this.shadowRoot?.getElementById(postID);
      replyMsg?.appendChild(msg);

      const bottomReplyBox = document.querySelector("#msg-box") as HTMLElement;
      bottomReplyBox!.hidden = true;

      const replyEvent = new CustomEvent("replyingToMessageEvent", {
        detail: { replyTarget: inputReply.id.substring(6) },
      });
      console.log("ReplyingToMessageEvent dispatched");
      document.dispatchEvent(replyEvent);

      console.log(userReplied);
    });
  }
  /**
   * Converts simple markup, such as **bold**, to their corresponding
   * HTML tags, such as <strong>.
   * @param post a post in the channel
   * @returns
   */
  appendPostFormat(post: PostItem) {
    const postText = document.createElement("p");
    postText.classList.add("post-text");
    postText.innerHTML = `${post.contents}`;

    postText.innerHTML = postText.innerHTML.replaceAll(
      /\*\*([^*]+)\*\*/g,
      "<strong>$1</strong>",
    ); // Bold
    postText.innerHTML = postText.innerHTML.replaceAll(
      /\*([^*]+)\*/g,
      "<em>$1</em>",
    ); // Italics

    // Iterate through all the emoji matches and convert them to the emoji html
    const matches = postText.innerHTML.match(/\:([^:]+)\:/g);
    matches?.forEach((match) => {
      //console.log("matched on: " + match)
      const name = match.substring(1, match.length - 1);
      //console.log("name: " + name)
      const emojiType = "twemoji:" + this.convertToEmoji(name);
      console.log("emoji type: " + emojiType);
      postText.innerHTML = postText.innerHTML.replace(
        match,
        "<iconify-icon icon=" +
          emojiType +
          " aria-label=" +
          name +
          " ></iconify-icon>",
      );
    });

    postText.innerHTML = postText.innerHTML.replaceAll(
      /\[(.+)\]\((.+)\)/g,
      '<a href="$2">$1</a>',
    ); // Links
    postText.innerHTML = postText.innerHTML.replaceAll(/\\n/g, "<br>"); // Newlines

    return postText;
  }
  /**
   * Adds the reaction options to the post.
   * @param post a post in the channel
   * @returns
   */
  appendReactions(post: PostItem) {
    const reactIcon = document.createElement("select");
    reactIcon.classList.add("react-btn");
    reactIcon.title = "Reaction Dropdown";
    reactIcon.innerHTML = `<option selected disabled hidden> &#x2B </option>`;
    reactIcon.id = "react-" + post.path;
    // reactIcon.id = post.path + "/reactions"; // TODO: the react button and the reply button have the same id, this is a accessibility issue

    const smileReact = document.createElement("option");
    smileReact.setAttribute("value", "smile");
    smileReact.innerHTML = ":)";
    const frownReact = document.createElement("option");
    frownReact.setAttribute("value", "frown");
    frownReact.innerHTML = ":(";
    const likeReact = document.createElement("option");
    likeReact.setAttribute("value", "like");
    likeReact.innerHTML = "👍";

    const celebrateReact = document.createElement("option");
    celebrateReact.setAttribute("value", "celebrate");
    celebrateReact.innerHTML = "🎉";

    reactIcon.appendChild(smileReact);
    reactIcon.appendChild(frownReact);
    reactIcon.appendChild(likeReact);
    reactIcon.appendChild(celebrateReact);

    reactIcon.addEventListener("change", () => {
      console.log("Post react button clicked");

      const reactionCreatedEvent = new CustomEvent("reactionCreatedEvent", {
        detail: {
          reactionType: reactIcon.value,
          targetPost: reactIcon.id.substring(6),
        },
      });

      console.log("reactionCreatedEvent dispatched from channel.ts");
      document.dispatchEvent(reactionCreatedEvent);
    });

    return reactIcon;
  }

  /**
   * Generates a random string for use as the id of a post.
   * @param length the length of the random string to be generated.
   */
  generateRandomString(length: number): string {
    let randString = "";
    const possibleChars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (let idx = 0; idx < length; idx++) {
      randString += possibleChars.charAt(
        Math.floor(Math.random() * possibleChars.length),
      );
    }

    return randString;
  }

  /**
   * Parses our input UNIX date time into a human readable format.
   * @param inputDate the Date() object in unix time representing the date to be returned as a string.
   */
  parseDate(inputDate: Date): string {
    // console.log(inputDate);

    const options: Intl.DateTimeFormatOptions = {
      dateStyle: "full",
      timeStyle: "long",
      hour12: true,
    };

    return Intl.DateTimeFormat("en-US", options).format(inputDate);
  }
  /**
   * Converts the project description emoji name to our emoji name.
   * @param reactionType the given name for the emoji as specified in the project description
   */
  convertToEmoji(reactionType: string): string {
    console.log(reactionType);
    let emojiType;

    switch (reactionType) {
      case "smile": {
        emojiType = "grinning-face-with-big-eyes";
        break;
      }
      case "frown": {
        emojiType = "frowning-face";
        break;
      }
      case "like": {
        emojiType = "thumbs-up";
        break;
      }
      case "celebrate": {
        emojiType = "partying-face";
        break;
      }
      default: {
        //statements;
        console.log("error! Invalid emoji");
        return "";
      }
    }
    return emojiType;
  }
  /**
   * Generates a reaction HTML component based on the input type and number of reactions.
   * @param reactionType string representing the type of reaction.
   * @param numReacts number representing the number of reactions of that type.
   */
  generateReaction(reactionType: string, numReacts: number) {
    // console.log(reactionType);
    let emojiType;

    switch (reactionType) {
      case "smile": {
        emojiType = "grinning-face-with-big-eyes";
        break;
      }
      case "frown": {
        emojiType = "frowning-face";
        break;
      }
      case "like": {
        emojiType = "thumbs-up";
        break;
      }
      case "celebrate": {
        emojiType = "partying-face";
        break;
      }
      default: {
        //statements;
        console.log("error! Invalid emoji");
        return "";
      }
    }

    const reactionButton = document.createElement("button");
    reactionButton.classList.add("reaction-btn");

    // Possible reaction types include:
    // 1. thumbs-up
    // 2. grinning-face-with-big-eyes
    // 3. frowning-face
    // 4. partying-face
    // TODO: Ensure Aria labels are correct
    const iconName = "twemoji:" + emojiType;
    reactionButton.innerHTML =
      "<iconify-icon icon=" +
      iconName +
      " " +
      "aria-label=" +
      reactionType +
      "></iconify-icon>" +
      " " +
      numReacts;

    return reactionButton;
  }

  initSSEMessages() {
    console.log("Initialized SSE for channel");

    document.addEventListener("postScheduleSent", (ev) => {
      if (!Helpers.isCustomEvent(ev))
        throw new Error("Error! Schedule Sent event type incorrect.");

      console.log("GOT SCHEDULED POST");
      console.log(ev);
      this.scheduledPosts.push(ev.detail.newPost);
      console.log(this.scheduledPosts);
    });

    // Create a listener for the channel opening
    document.addEventListener("serverSideMessageEvent", (e: Event) => {
      if (!Helpers.isCustomEvent(e))
        throw new Error("Error! SSE event type incorrect.");

      if (JSON.stringify(e.detail.postContents).length === 2) {
        console.log("Empty post received");
        this.checkQueue();
        return;
      }

      console.log("Incoming SSE Post Received!");
      // For each message, we create the corresponding HTML component.
      // 'delete' events are not possible on posts, and must be errors.
      // 'update' events can occur, in the case of a post being added or modified

      // If the path of the post already exists on the page, we should replace that HTML component with it,
      const postKey = this.postIDMap.get(encodeURI(e.detail.postContents.path));
      if (postKey != undefined) {
        if (this.shadowRoot?.getElementById(postKey) != undefined) {
          this.updatePost(e.detail.postContents);
          return;
        }
      }

      console.log("Post to update is new to page");

      // Otherwise, we append it to the main page or the parent.
      this.addPostToChannel(e.detail.postContents);
    });
  }

  /**
   * This checks the queue of schedule send messages to see if any of them have elapsed
   */
  checkQueue() {
    // Only check if there are posts that have not yet been sent.
    if (this.scheduledPosts.length > 0) {
      console.log("Checking scheduled posts..");
      console.log(this.scheduledPosts);
      for (let idx = 0; idx < this.scheduledPosts.length; idx++) {
        const inputPost = this.scheduledPosts[idx];

        const timeObj = inputPost.extensions as extensionData;

        if (!timeObj) {
          console.log("Error! No extension found on post object");
          return;
        }

        if (!timeObj.scheduledTime) {
          console.log("Error! No scheduled time found on post object");
          return;
        }

        const postTime = new Date(Number(timeObj.scheduledTime));

        if (postTime.getTime() < Date.now()) {
          // Success!
          this.scheduledPosts.splice(idx, 1);

          // Posts the message to the database
          const postCreatedEvent = new CustomEvent("postCreatedEvent", {
            detail: {
              postData: inputPost,
            },
          });
          console.log("scheduled postCreatedEvent dispatched from channel.ts");
          document.dispatchEvent(postCreatedEvent);

          break;
        } else {
          console.log("Post not yet sent!");
          console.log("Waiting until... " + postTime.getTime());
          console.log("It is currently: " + Date.now());
        }
      }
    }
  }
}

customElements.define("channel-display", ChannelDisplay);
