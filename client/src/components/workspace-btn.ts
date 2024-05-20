/* A web component to query and display the workspaces in the current database. */
import {
  WorkspaceChosenEvent,
  InitWorkspacesEvent,
  CreateWorkspaceEvent,
  DeleteWorkspaceEvent,
} from "../view";
import Helpers from "../helpers/helpers";

declare global {
  interface DocumentEventMap {
    workspaceChosenEvent: CustomEvent<WorkspaceChosenEvent>;
    initWorkspacesEvent: CustomEvent<InitWorkspacesEvent>;
    createWorkspaceEvent: CustomEvent<CreateWorkspaceEvent>;
    deleteWorkspaceEvent: CustomEvent<DeleteWorkspaceEvent>;
  }
}

// The workspace button queries and manages operations on available workspaces for the user.
class WorkspaceButton extends HTMLElement {
  private controller: AbortController | null = null;
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    if (this.shadowRoot) {
      // This could also come from an HTML template
      this.shadowRoot.innerHTML = `
        <style>
            select {
              width: 100%;
              font-size: 0.8rem;
              font-weight: bold;
              letter-spacing: 0.063rem;
              padding: 0.675em 6em 0.5em 0.5em;
              background-color: dimgrey;
              border: 1px solid #caced1;
              border-radius: 0.25rem;
              color: white;
              cursor: pointer;
            }
            
        </style>
            <label for="workspace-name" id="label-dropdown" style="position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;">Workspace dropdown: </label>
            <select name="workspace-button" id="workspace-name"> 
                <option disabled selected hidden value="default-ws-option"> WORKSPACE </option>
                <option value="refresh-ws"> REFRESH ♻️</option>
                <option value="create-ws">CREATE ✏️</option> 
                <option value="delete-ws">DELETE ❌</option> 
                <option disabled value="line-divider"> ────────── </option>
        `;
    } else {
      throw new Error("shadowRoot does not exist");
    }
  }

  /**
   * Called when we load the page
   */
  connectedCallback(): void {
    this.clear();
    this.initWorkspaces();
  }

  /**
   * Uses the workspaces queried from the model to display in dropdown.
   * @returns nothing
   */
  initWorkspaces(): void {
    // Get the select element from the shadow DOM
    const selectForm = this.shadowRoot?.getElementById("workspace-name");

    if (!(selectForm instanceof HTMLSelectElement)) {
      console.log(
        "Error: #workspace-button is not an HTML Select Element",
        selectForm,
      );
      return;
    }

    document.addEventListener("initWorkspacesEvent", (e: Event) => {
      if (!Helpers.isCustomEvent(e))
        throw new Error("Error! Workspace event type incorrect.");
      // Now, we know if "e" is of the correct event type.

      console.log("WORKSPACES EVENT RECEIVED BY COMPONENT");
      // Delete the previous workspace options from the dropdown
      for (var i = selectForm.length - 1; i >= 0; i--) {
        if (
          selectForm.options[i].value != "default-ws-option" &&
          selectForm.options[i].value != "refresh-ws" &&
          selectForm.options[i].value != "create-ws" &&
          selectForm.options[i].value != "delete-ws" &&
          selectForm.options[i].value != "line-divider"
        ) {
          selectForm.remove(i);
        }
      }
      // Add the new workspace options to the dropdown
      e.detail.workspaces.forEach((workspace: string) => {
        const wsItem = document.createElement("option");
        wsItem.textContent = `${workspace}`;

        selectForm.appendChild(wsItem);
      });
    });

    selectForm.addEventListener("change", (event) => {
      // Stop the browser from trying to "submit" the login.
      event.preventDefault();
      // Handle creating a new workspace
      if (selectForm.value == "create-ws") {
        console.log("Request to create a new workspace");
        this.createWorkspacePopup();
      } else if (selectForm.value == "delete-ws") {
        console.log("Request to delete a workspace");
        this.deleteWorkspacePopup();
      } else if (selectForm.value == "refresh-ws") {
        console.log("Refreshing workspaces...");
        const workspaceRefresh = new CustomEvent("refreshWorkspacesEvent", {
          detail: { id: "refresh" },
        });
        document.dispatchEvent(workspaceRefresh);
      } else if (selectForm.value != "Workspace") {
        console.log(`Workspace Chosen: ${selectForm.value}`);
        // todo: reset posts display

        // todo: here i need to send first a
        const workspaceChosen = new CustomEvent("workspaceChosenEvent", {
          detail: { currentWorkspace: selectForm.value },
        });

        document.dispatchEvent(workspaceChosen);
      }
      selectForm.value = "default-ws-option";
    });
  }

  /**
   * Creates a new modal for the creation of a new workspace
   */
  createWorkspacePopup(): void {
    // Create a modal pop-up that will allow a user to create a new workspace
    const wsForm = document.createElement("article");
    wsForm.id = "workspace-form";
    wsForm.classList.add("modal");
    const innerWSContent = document.createElement("article");
    innerWSContent.classList.add("modal-content");
    innerWSContent.id = "inner-ws-content";
    const header = document.createElement("h2");
    header.innerHTML = "Create a workspace:";
    innerWSContent.appendChild(header);
    const input = document.createElement("input");
    input.type = "text";
    input.id = "workspace";
    input.placeholder = "Workspace name here...";
    innerWSContent.appendChild(input);
    const buttonSubmit = document.createElement("button");
    buttonSubmit.id = "submit-ws";
    buttonSubmit.innerHTML = "Submit";
    const buttonCancel = document.createElement("button");
    buttonCancel.id = "cancel-ws";
    buttonCancel.innerHTML = "Cancel";
    innerWSContent.appendChild(buttonSubmit);
    innerWSContent.appendChild(buttonCancel);
    wsForm.appendChild(innerWSContent);
    console.log(wsForm);
    document.body.appendChild(wsForm);

    const errorMessage = document.createElement("p");
    errorMessage.id = "error-message";
    errorMessage.style.color = "red";
    errorMessage.style.display = "none"; // Initially hidden
    innerWSContent.insertBefore(errorMessage, buttonSubmit);

    buttonSubmit.addEventListener("click", (event) => {
      console.log("Create workspace button clicked");
      const workspace = (<HTMLInputElement>document.getElementById("workspace"))
        ?.value;
      if (workspace === "") {
        console.log(
          "You cannot have a workspace with no name. Try again with a non-empty name.",
        );
        errorMessage.textContent = "Try again with a non-empty name.";
        errorMessage.style.display = "block";
        return;
      }
      console.log("New workspace name: " + workspace);
      const errorMsg = this.createWorkspace(workspace);

      // Get rid of the modal popup
      if (errorMsg) {
        errorMessage.textContent = errorMsg;
        errorMessage.style.display = "block";
      } else {
        // Workspace created successfully, remove the modal popup
        wsForm.remove();
      }
    });

    buttonCancel.addEventListener("click", (event) => {
      wsForm.remove();
    });
  }

  /**
   * Creates the workspace by dispatching to main and adding it to the dropdown.
   * @param workspace the name of the new workspace
   * @returns null
   */
  createWorkspace(workspace: string): string | null {
    // Pass the workspace event to main.
    // Works for other events.. why is this one different
    const selectForm = this.shadowRoot?.getElementById("workspace-name");
    if (!(selectForm instanceof HTMLSelectElement)) {
      console.log(
        "Error: #workspace-button is not an HTML Select Element",
        selectForm,
      );
      return null;
    }
    // Check if workspace already exists in the dropdown
    let exists = false;
    for (let i = 0; i < selectForm.options.length; i++) {
      if (selectForm.options[i].text === workspace) {
        exists = true;
        break;
      }
    }
    if (exists) {
      console.log(`Workspace "${workspace}" already exists in the dropdown.`);
      return `Error: Workspace "${workspace}" already exists.`;
    }

    const createWorkspaceEvent = new CustomEvent("createWorkspaceEvent", {
      detail: {
        workspace: workspace,
      },
    });

    // Workspace notification sent out.
    document.dispatchEvent(createWorkspaceEvent);

    // Add this workspace to the dropdown list
    const wsItem = document.createElement("option");
    wsItem.textContent = `${workspace}`;
    selectForm.appendChild(wsItem);
    return null;
  }

  /**
   * Creates a new modal for deletion of a workspace
   */
  deleteWorkspacePopup(): void {
    // Create a modal pop-up that will allow a user to delete a workspace
    const wsForm = document.createElement("article");
    wsForm.id = "workspace-form";
    wsForm.classList.add("modal");
    const innerWSContent = document.createElement("article");
    innerWSContent.classList.add("modal-content");
    innerWSContent.id = "inner-ws-content";
    const header = document.createElement("h2");
    header.innerHTML = "Select a workspace to delete:";
    innerWSContent.appendChild(header);
    const dropdown = this.shadowRoot?.querySelector("#workspace-name");
    const newDropdown = dropdown?.cloneNode(true);

    // Verify that newDropdown is a dropdown element and it exists
    if (!newDropdown) {
      console.log("Error: #workspace-name does not exist");
      return;
    }
    if (!(newDropdown instanceof HTMLSelectElement)) {
      console.log("Error: #workspace-name is not a dropdown:", newDropdown);
      return;
    }
    newDropdown.id = "select-ws-delete";

    // Delete the non-workspace options from the cloned dropdown
    for (var i = newDropdown.length - 1; i >= 0; i--) {
      if (
        newDropdown.options[i].value == "default-ws-option" ||
        newDropdown.options[i].value == "refresh-ws" ||
        newDropdown.options[i].value == "create-ws" ||
        newDropdown.options[i].value == "delete-ws" ||
        newDropdown.options[i].value == "line-divider"
      ) {
        newDropdown.remove(i);
      }
    }
    innerWSContent.appendChild(newDropdown);
    const buttonSubmit = document.createElement("button");
    buttonSubmit.id = "delete-ws-btn";
    buttonSubmit.innerHTML = "Submit";
    const buttonCancel = document.createElement("button");
    buttonCancel.id = "delete-cancel-ws-btn";
    buttonCancel.innerHTML = "Cancel";
    innerWSContent.appendChild(buttonSubmit);
    innerWSContent.appendChild(buttonCancel);
    wsForm.appendChild(innerWSContent);
    console.log(wsForm);
    document.body.appendChild(wsForm);

    // Get the desired workspace to be deleted
    let wsDeleteMe = newDropdown.value;
    newDropdown.addEventListener("change", (event) => {
      event.preventDefault();
      wsDeleteMe = newDropdown.value;
    });

    buttonSubmit.addEventListener("click", (event) => {
      console.log("Delete workspace button clicked");
      // Stop the browser from trying to "submit".
      event.preventDefault();
      console.log("Workspace to be deleted: " + wsDeleteMe);
      this.deleteWorkspace(wsDeleteMe);

      // Get rid of the modal popup
      wsForm.remove();
    });

    buttonCancel.addEventListener("click", (event) => {
      wsForm.remove();
    });
  }

  /**
   * Passes the event to main and removes the workspace from the dropdown.
   * @param workspace the name of the workspace to be deleted
   * @returns nothing
   */
  deleteWorkspace(workspace: string): void {
    // Pass the workspace event to main.
    const deleteWorkspaceEvent = new CustomEvent("deleteWorkspaceEvent", {
      detail: {
        workspace: workspace,
      },
    });

    // Workspace notification sent out.
    document.dispatchEvent(deleteWorkspaceEvent);

    // Remove this workspace from the dropdown list
    const dropdown = this.shadowRoot?.querySelector("#workspace-name");
    if (!dropdown) {
      console.log("Error: #workspace-name does not exist");
      return;
    }
    if (!(dropdown instanceof HTMLSelectElement)) {
      console.log("Error: #workspace-name is not a dropdown:", dropdown);
      return;
    }
    for (var i = dropdown.length - 1; i >= 0; i--) {
      if (dropdown.options[i].value == workspace) {
        dropdown.remove(i);
      }
    }
  }

  /**
   * Clears.
   */
  clear(): void {}

  /**
   * Called when we delete the workspace button.
   */
  disconnectedCallback(): void {
    this.controller?.abort();
    this.controller = null;
  }
}

customElements.define("workspace-btn", WorkspaceButton);
