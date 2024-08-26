/// <reference types="cypress" />
import { AppElements as ae } from "../support/elements/app-elements";

context("Test the overall app", () => {
  beforeEach(() => {
    cy.visit("");
  });

  describe("Desktop functionalities", () => {
    it("renders with text", () => {
      ae.getApp().invoke("text").should("include", "Allow others to join your table");
    });
  });
});
