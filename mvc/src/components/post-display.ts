import { extensionData, PostItem } from "../main";
import Helpers from "../helpers/helpers";

class ChannelDisplay extends HTMLElement {
  private postIDMap = new Map<string, string>();
  private pendingPostQueue = new Map<string, PostItem[]>();
  private scheduledPosts: PostItem[] = [];
  private currentPosts: PostItem[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.addEventListeners();
  }

  connectedCallback() {
    this.initSSEMessages();
    this.clearDisplay("Waiting for posts...");
  }

  private addEventListeners() {
    document.addEventListener("postsLoadedEvent", (e: Event) => {
      if (!Helpers.isCustomEvent(e)) throw new Error("Invalid event type.");
      this.resetChannel();
      this.initChannel();
    });

    ["deleteChannelEvent", "workspaceChosenEvent", "logoutEvent", "createWorkspaceEvent", "deleteWorkspaceEvent"].forEach(event =>
      document.addEventListener(event, () => this.clearDisplay("No workspace selected. Select a workspace to see posts..."))
    );

    document.addEventListener("clearReplyBox", () => {
      this.shadowRoot?.querySelectorAll("#curr-reply-box").forEach(box => box.remove());
      document.dispatchEvent(new CustomEvent("replyingToMessageEvent", { detail: { replyTarget: "" } }));
      (document.querySelector("#msg-box") as HTMLElement).hidden = false;
    });
  }

  private resetChannel() {
    this.postIDMap.clear();
    this.currentPosts = [];
    this.pendingPostQueue.clear();
  }

  private clearDisplay(message: string) {
    if (!this.shadowRoot) throw new Error("shadowRoot does not exist");
    this.shadowRoot.innerHTML = `<style>@import url('styles.css');</style><article id="default-no-posts">${message}</article>`;
  }

  private initChannel() {
    const postGroup = document.createElement("ul");
    postGroup.classList.add("post-list");
    postGroup.id = "channel-post-list";
    this.shadowRoot?.append(postGroup);
  }

  private addPostToChannel(post: PostItem) {
    const parentKey = this.postIDMap.get(encodeURI(post.parent));
    if (parentKey && this.shadowRoot?.getElementById(parentKey)) {
      this.addChildPost(post);
    } else if (post.parent) {
      this.addPostToQueue(post.parent, post);
    } else {
      this.addParentPost(post);
    }

    if (this.pendingPostQueue.has(post.path)) {
      this.pendingPostQueue.get(post.path)?.sort((a, b) => a.creationTime - b.creationTime).forEach(newChild => {
        this.addPostToChannel(newChild);
        this.pendingPostQueue.delete(post.path);
      });
    }
  }

  private updatePost(post: PostItem) {
    const oldElemPath = this.postIDMap.get(encodeURI(post.path));
    const oldPost = this.shadowRoot?.getElementById(oldElemPath!);
    if (!oldPost) return;

    oldPost.querySelectorAll(".reaction-btn").forEach(btn => btn.remove());

    Object.entries(post.reactions || {}).forEach(([reaction, users]) => {
      if (users.length) oldPost.append(this.generateReaction(reaction, users.length));
    });
  }

  private addPostToQueue(parentPath: string, post: PostItem) {
    if (!this.pendingPostQueue.has(parentPath)) this.pendingPostQueue.set(parentPath, []);
    this.pendingPostQueue.get(parentPath)?.push(post);
  }

  private addParentPost(post: PostItem) {
    const postGroup = this.shadowRoot?.querySelector("#channel-post-list");
    if (!postGroup) throw new Error("Post group not found");

    const postElement = this.createPostElement(post);
    const insertIndex = this.currentPosts.findIndex(p => post.creationTime < p.creationTime);

    if (insertIndex === -1) {
      postGroup.appendChild(postElement);
      this.currentPosts.push(post);
    } else {
      postGroup.insertBefore(postElement, postGroup.children[insertIndex]);
      this.currentPosts.splice(insertIndex, 0, post);
    }
  }

  private addChildPost(post: PostItem) {
    const parentNode = this.shadowRoot?.getElementById(this.postIDMap.get(encodeURI(post.parent))!);
    if (!parentNode) throw new Error("Parent post not found");

    parentNode.append(this.createPostElement(post));
    this.currentPosts.push(post);
  }

  private createPostElement(post: PostItem) {
    const postItem = document.createElement("li");
    postItem.classList.add("post");
    postItem.innerHTML = `${post.author} @ ${this.parseDate(new Date(post.creationTime))}`;
    postItem.id = this.generateRandomString(10);
    this.postIDMap.set(encodeURI(post.path), postItem.id);

    const replyBtn = document.createElement("button");
    replyBtn.classList.add("reply-btn");
    replyBtn.innerHTML = `&#x2807`;
    replyBtn.addEventListener("click", () => this.handleReplyClick(replyBtn.id, postItem.id));

    postItem.append(replyBtn, this.createReactionDropdown(post));
    return postItem;
  }

  private handleReplyClick(replyID: string, postID: string) {
    document.querySelector("#msg-box")!.hidden = true;
    document.dispatchEvent(new CustomEvent("replyingToMessageEvent", { detail: { replyTarget: replyID.substring(6) } }));

    const msg = document.createElement("message-box");
    msg.id = "curr-reply-box";
    this.shadowRoot?.getElementById(postID)?.appendChild(msg);
  }

  private createReactionDropdown(post: PostItem) {
    const reactIcon = document.createElement("select");
    reactIcon.classList.add("react-btn");
    reactIcon.innerHTML = `<option selected disabled hidden> &#x2B </option>`;

    ["smile", "frown", "like", "celebrate"].forEach(reaction => {
      const option = document.createElement("option");
      option.value = reaction;
      option.innerHTML = reaction === "smile" ? ":)" : reaction === "frown" ? ":(" : reaction === "like" ? "👍" : "🎉";
      reactIcon.appendChild(option);
    });

    reactIcon.addEventListener("change", () => {
      document.dispatchEvent(new CustomEvent("reactionCreatedEvent", {
        detail: { reactionType: reactIcon.value, targetPost: reactIcon.id.substring(6) },
      }));
    });

    return reactIcon;
  }

  private generateReaction(reactionType: string, numReacts: number) {
    const emojiMap: { [key: string]: string } = {
      "smile": "grinning-face-with-big-eyes",
      "frown": "frowning-face",
      "like": "thumbs-up",
      "celebrate": "partying-face"
    };

    if (!emojiMap[reactionType]) return "";
    const reactionButton = document.createElement("button");
    reactionButton.classList.add("reaction-btn");
    reactionButton.innerHTML = `<iconify-icon icon="twemoji:${emojiMap[reactionType]}" aria-label="${reactionType}"></iconify-icon> ${numReacts}`;
    return reactionButton;
  }

  private generateRandomString(length: number) {
    return Array.from({ length }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(Math.random() * 52))).join("");
  }

  private parseDate(inputDate: Date) {
    return Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "long", hour12: true }).format(inputDate);
  }
}

customElements.define("channel-display", ChannelDisplay);
