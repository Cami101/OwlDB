/**
 * The MessageBox class creates the input submission form component for our messaging app.
 * Allows the user to add emojis, formatting, and schedule send posts.
 */
export class MessageBox extends HTMLElement {
  private controller: AbortController | null = null;
  private replyTo: string;

  constructor() {
    super();
    this.replyTo = "";
    this.attachShadow({ mode: "open" });

    if (this.shadowRoot) {
      // This could also come from an HTML template
      this.shadowRoot.innerHTML = `
        <style>
          .post-button {
                padding: 0.313rem 0.625rem;
                font-size: 0.875rem;
          }
          .input-box {
          width: 80%;
          padding: 1rem 1.5rem;
          margin: 0.5rem 0;
          box-sizing: border-box;
          }
        </style>
        <section class="content-footer" id="message-box">
            <input type="text" placeholder="Type here..." id="inputBox" class="input-box"/>
            <button class="post-button">Post</button>
            <br>
            <button class="bold-button"><b>Bold</b></button>
            <button class="italics-button"><i>Italics</i></button>
            <button class="links-button">Link <iconify-icon icon="twemoji:link" aria-label="link"></iconify-icon></button>
            <button class="smile-button"><iconify-icon icon="twemoji:grinning-face-with-big-eyes" aria-label="smile"></iconify-icon></button>
            <button class="sad-button"><iconify-icon icon="twemoji:frowning-face" aria-label="sad"></iconify-icon></button>
            <button class="like-button"><iconify-icon icon="twemoji:thumbs-up" aria-label="like"></iconify-icon></button>
            <button class="celebrate-button"><iconify-icon icon="twemoji:partying-face" aria-label="celebrate"></iconify-icon></button>
            <button class="ss-button">Schedule</button>
            <span id="timeDisplay" style="font-size: small"><b> Send: </b></span><span id="sendTime" style="font-size: x-small">Now</span>
        </section>      
        `;
    } else {
      throw new Error("shadowRoot does not exist");
    }

    // Trigger this event whenever we reply to a message.
    document.addEventListener("replyingToMessageEvent", (event) => {
      this.setReplier(event.detail.replyTarget);
    });

    this.makeEventListeners(this.shadowRoot);
  }

  /**
   * Makes the event listeners for all the buttons associated with a message box.
   * @param shadowRoot the shadow root for this message box
   * @returns
   */
  makeEventListeners(shadowRoot: ShadowRoot) {
    const submitPostButton = shadowRoot?.querySelector(".post-button");

    if (!(submitPostButton instanceof HTMLButtonElement)) {
      console.log("Error: #post-button is not a button:", submitPostButton);
      return;
    }

    const inputText = shadowRoot?.getElementById(
      "inputBox",
    ) as HTMLInputElement;
    inputText?.addEventListener("keydown", (event) => {
      if (event.shiftKey && event.key === "Enter") {
        console.log("shift+enter pressed");
        event.preventDefault();
        const input = inputText.value;
        inputText.value = input + "\\n";
      } else if (event.key === "Enter") {
        submitPostButton.click();
      }
    });

    submitPostButton.addEventListener("click", (event) => {
      console.log("Create post button clicked");

      // Make sure a channel is selected before posting
      const checkedChannel = document.querySelectorAll(
        "input[type='radio']:checked",
      );

      if (checkedChannel === undefined) {
        throw new Error("Radio buttons not found");
      }

      let channelFound = "";
      for (let idx = 0; idx < checkedChannel.length; idx++) {
        const selection = checkedChannel[idx];
        if (selection instanceof HTMLInputElement) {
          channelFound = selection.value;
        }
      }
      if (channelFound == "") {
        alert("No channel selected. Please select a channel.");
        console.log("No channel selected. Please select a channel");
        return;
      }

      const postMessage = (<HTMLInputElement>(
        shadowRoot?.getElementById("inputBox")
      ))?.value;
      // Confirm that post is non-empty
      if (postMessage == "") {
        console.log(
          "You cannot have a post with no input. Try again with a non-empty name.",
        );
        alert(
          "You cannot have a post with no input. Try again with a non-empty name.",
        );
        return;
      }
      console.log("New post with msg: " + postMessage);

      const postAuthor = document.getElementById("loginUserName")?.textContent;

      if (!postAuthor) {
        console.log("Error getting post author!");
        return;
      }

      // Clear the text box after you post
      (<HTMLInputElement>shadowRoot?.getElementById("inputBox"))!.value = "";

      const dateStr = this.shadowRoot?.getElementById("sendTime")?.textContent;
      console.log("DATE STRING:" + dateStr);
      if (dateStr && dateStr != "Now") {
        const timeToSend = new Date(dateStr).getTime();
        console.log(timeToSend);

        if (timeToSend > Date.now()) {
          this.scheduleMessage(
            postAuthor,
            postMessage,
            this.replyTo,
            timeToSend,
          );
        }
      } else {
        // Post the message to the database
        const postCreatedEvent = new CustomEvent("postCreatedEvent", {
          detail: {
            postData: {
              path: "", // Incoming post PATH is generated by PUT
              author: postAuthor,
              creationTime: Date.now(),
              contents: postMessage,
              parent: this.replyTo, // TODO: Set this field as nonempty when "replyto" is true
              reactions: {
                smile: [],
                frown: [],
                like: [],
                celebrate: [],
              },
            },
          },
        });
        console.log("postCreatedEvent dispatched from messagebox.ts");
        document.dispatchEvent(postCreatedEvent);
      }
      // In this case, we submitted a message that is a reply.
      if (this.replyTo != "") {
        console.log("this is a reply!");
        const bottomReplyBox = document.querySelector(
          "#msg-box",
        ) as HTMLElement;
        bottomReplyBox!.hidden = false;

        const clearReplierEvent = new CustomEvent("clearReplyBox", {
          detail: { targetMessage: this.replyTo },
        });

        console.log("clearReply dispatched from messagebox.ts");
        document.dispatchEvent(clearReplierEvent);
      }

      const sendTime = shadowRoot?.querySelector("#sendTime");
      sendTime!.innerHTML = "Now";
      this.setReplier("");
    });

    const boldTextBtn = shadowRoot?.querySelector(".bold-button");
    if (!(boldTextBtn instanceof HTMLButtonElement)) {
      console.log("Error: .bold-button is not a button:", boldTextBtn);
      return;
    }

    boldTextBtn.addEventListener("click", (event) => {
      console.log("Bold button clicked!");
      // Get the current text in the input box
      const postMessage = (<HTMLInputElement>(
        shadowRoot?.getElementById("inputBox")
      ))?.value;

      // Add bold markers at the end
      (<HTMLInputElement>shadowRoot?.getElementById("inputBox"))!.value =
        postMessage + " **Type bolded message here**";
    });

    const italicsTextBtn = shadowRoot?.querySelector(".italics-button");
    if (!(italicsTextBtn instanceof HTMLButtonElement)) {
      console.log("Error: .italics-button is not a button:", italicsTextBtn);
      return;
    }

    italicsTextBtn.addEventListener("click", (event) => {
      console.log("Italics button clicked!");
      // Get the current text in the input box
      const postMessage = (<HTMLInputElement>(
        shadowRoot?.getElementById("inputBox")
      ))?.value;

      // Add italics markers at the end
      (<HTMLInputElement>shadowRoot?.getElementById("inputBox"))!.value =
        postMessage + " *Type italics message here*";
    });

    const linksTextBtn = shadowRoot?.querySelector(".links-button");
    if (!(linksTextBtn instanceof HTMLButtonElement)) {
      console.log("Error: .links-button is not a button:", linksTextBtn);
      return;
    }

    linksTextBtn.addEventListener("click", (event) => {
      console.log("Links button clicked!");
      // Get the current text in the input box
      const postMessage = (<HTMLInputElement>(
        shadowRoot?.getElementById("inputBox")
      ))?.value;

      // Add bold markers at the end
      (<HTMLInputElement>shadowRoot?.getElementById("inputBox"))!.value =
        postMessage + " [Message to be shown goes here](Link goes here)";
    });

    const smileBtn = shadowRoot?.querySelector(".smile-button");
    if (!(smileBtn instanceof HTMLButtonElement)) {
      console.log("Error: .smile-button is not a button:", smileBtn);
      return;
    }

    smileBtn.addEventListener("click", (event) => {
      console.log("Smile button clicked!");
      // Get the current text in the input box
      const postMessage = (<HTMLInputElement>(
        shadowRoot?.getElementById("inputBox")
      ))?.value;

      // Add bold markers at the end
      (<HTMLInputElement>shadowRoot?.getElementById("inputBox"))!.value =
        postMessage + " :smile:";
    });

    const likeBtn = shadowRoot?.querySelector(".like-button");
    if (!(likeBtn instanceof HTMLButtonElement)) {
      console.log("Error: .like-button is not a button:", smileBtn);
      return;
    }

    likeBtn.addEventListener("click", (event) => {
      console.log("Like button clicked!");
      // Get the current text in the input box
      const postMessage = (<HTMLInputElement>(
        shadowRoot?.getElementById("inputBox")
      ))?.value;

      // Add bold markers at the end
      (<HTMLInputElement>shadowRoot?.getElementById("inputBox"))!.value =
        postMessage + " :like:";
    });

    const sadBtn = shadowRoot?.querySelector(".sad-button");
    if (!(sadBtn instanceof HTMLButtonElement)) {
      console.log("Error: .sad-button is not a button:", sadBtn);
      return;
    }

    sadBtn.addEventListener("click", (event) => {
      console.log("Sad button clicked!");
      // Get the current text in the input box
      const postMessage = (<HTMLInputElement>(
        shadowRoot?.getElementById("inputBox")
      ))?.value;

      // Add bold markers at the end
      (<HTMLInputElement>shadowRoot?.getElementById("inputBox"))!.value =
        postMessage + " :frown:";
    });

    const partyBtn = shadowRoot?.querySelector(".celebrate-button");
    if (!(partyBtn instanceof HTMLButtonElement)) {
      console.log("Error: .celebrate-button is not a button:", partyBtn);
      return;
    }

    partyBtn.addEventListener("click", (event) => {
      console.log("Party button clicked!");
      // Get the current text in the input box
      const postMessage = (<HTMLInputElement>(
        shadowRoot?.getElementById("inputBox")
      ))?.value;

      // Add bold markers at the end
      (<HTMLInputElement>shadowRoot?.getElementById("inputBox"))!.value =
        postMessage + " :celebrate:";
    });

    const ssBtn = shadowRoot?.querySelector(".ss-button");
    if (!(ssBtn instanceof HTMLButtonElement)) {
      console.log("Error: .ss-button is not a button:", ssBtn);
      return;
    }

    ssBtn.addEventListener("click", (event) => {
      console.log("Schedule button clicked!");
      // Make a modal pop up for selecting a date
      const selectDateForm = document.createElement("article");
      selectDateForm.id = "date-form";
      selectDateForm.classList.add("modal");
      const innerContent = document.createElement("article");
      innerContent.classList.add("modal-content");
      innerContent.id = "inner-date-content";
      const header = document.createElement("h2");
      header.innerHTML = "Select a date and time to schedule send:";
      innerContent.appendChild(header);
      const inputDate = document.createElement("input");
      inputDate.type = "date";
      inputDate.id = "date-ss";
      innerContent.appendChild(inputDate);
      const inputTime = document.createElement("input");
      inputTime.type = "time";
      inputTime.id = "time-ss";
      innerContent.appendChild(inputTime);
      const button = document.createElement("button");
      button.id = "submit-date";
      button.innerHTML = "Submit";
      innerContent.appendChild(button);
      const cancel = document.createElement("button");
      cancel.id = "cancel-date";
      cancel.innerHTML = "Cancel";
      innerContent.appendChild(cancel);
      selectDateForm.appendChild(innerContent);
      console.log(selectDateForm);
      document.body.appendChild(selectDateForm);

      // Cancels the schedule send
      cancel.addEventListener("click", (event) => {
        selectDateForm.remove();
      });

      button.addEventListener("click", (event) => {
        const date = inputDate.value;
        const time = inputTime.value;
        console.log("Selected date: " + date);
        console.log("Selected time: " + time);
        // Make sure a date and a time are selected
        if (date == "" || time == "") {
          console.log("Date or time not selected!");
          const oldError = document.querySelector("#error-msg-date");
          oldError?.remove();
          const error = document.createElement("p");
          error.id = "error-msg-date";
          error.innerHTML = "Error: date AND time must be selected";
          const innerContent = document.querySelector("#inner-date-content");
          innerContent?.append(error);
          return;
        }
        let dateTime = new Date();
        console.log("Current date = " + dateTime); // Wed Nov 29 2023 13:45:48 GMT-0600 (Central Standard Time)
        const inputtedDate = new Date(date + "T" + time); // '1995-12-17T03:24:00'
        console.log("Input date object= " + inputtedDate);

        // Make sure the date is not in the past
        if (dateTime > inputtedDate) {
          console.log("Date selected is in the past!");
          const oldError = document.querySelector("#error-msg-date");
          oldError?.remove();
          const error = document.createElement("p");
          error.id = "error-msg-date";
          error.innerHTML = "Error: date must not be in the past";
          const innerContent = document.querySelector("#inner-date-content");
          innerContent?.append(error);
          return;
        }
        const sendTime = shadowRoot?.querySelector("#sendTime");
        sendTime!.innerHTML = date + "T" + time;

        selectDateForm.remove();
      });
    });
  }

  /**
   * Sets the replyTo field with the name of the user we are replying to.
   * @param inputUser the user who made the post we are replying to
   */
  setReplier(inputUser: string) {
    this.replyTo = inputUser;
  }

  /**
   * Called when we load the page
   */
  connectedCallback(): void {}

  /**
   * Called when we remove the message box from the page.
   */
  disconnectedCallback(): void {
    this.controller?.abort();
    this.controller = null;
  }

  scheduleMessage(
    username: string,
    contents: string,
    parentMsg: string,
    timeToSend: number,
  ) {
    const scheduledPost = new CustomEvent("postScheduleSent", {
      detail: {
        newPost: {
          path: "",
          author: username,
          creationTime: Date.now(),
          contents: contents,
          parent: parentMsg,
          reactions: {
            smile: [],
            frown: [],
            like: [],
            celebrate: [],
          },
          extensions: {
            scheduledTime: timeToSend.toString(),
          },
        },
      },
    });

    document.dispatchEvent(scheduledPost);
  }
}

customElements.define("message-box", MessageBox);
