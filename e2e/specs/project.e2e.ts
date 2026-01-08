import { expect } from '@wdio/globals'

describe('Project Management', () => {
  describe('Create Project', () => {
    it('should create a new project successfully', async () => {
      // Wait for the app to load
      await browser.pause(2000)

      // Click the "New Project" button
      const newProjectBtn = await $('[data-testid="new-project-btn"]')
      await newProjectBtn.waitForDisplayed({ timeout: 5000 })
      await newProjectBtn.click()

      // Wait for the form to appear
      const form = await $('[data-testid="new-project-form"]')
      await form.waitForDisplayed({ timeout: 5000 })

      // Fill in the project name
      const nameInput = await $('[data-testid="project-name-input"]')
      await nameInput.setValue('E2E Test Project')

      // Fill in the description (optional)
      const descInput = await $('[data-testid="project-desc-input"]')
      await descInput.setValue('This project was created by E2E test')

      // Click create button
      const createBtn = await $('[data-testid="create-project-btn"]')
      await createBtn.click()

      // Wait for navigation to the new project page
      await browser.pause(1000)

      // Verify we're on the project detail page (URL should contain /project/)
      const url = await browser.getUrl()
      expect(url).toContain('/project/')
    })

    it('should cancel project creation', async () => {
      // Navigate back to home
      await browser.url('/')
      await browser.pause(1000)

      // Click the "New Project" button
      const newProjectBtn = await $('[data-testid="new-project-btn"]')
      await newProjectBtn.waitForDisplayed({ timeout: 5000 })
      await newProjectBtn.click()

      // Wait for the form to appear
      const form = await $('[data-testid="new-project-form"]')
      await form.waitForDisplayed({ timeout: 5000 })

      // Click cancel button
      const cancelBtn = await $('[data-testid="cancel-create-btn"]')
      await cancelBtn.click()

      // Verify the form is hidden
      await form.waitForDisplayed({ timeout: 5000, reverse: true })
    })

    it('should show created project in the list', async () => {
      // Navigate back to home
      await browser.url('/')
      await browser.pause(1000)

      // Look for project cards
      const projectCards = await $$('[data-testid="project-card"]')

      // There should be at least one project (the one we created)
      expect(projectCards.length).toBeGreaterThan(0)

      // Find the project we created
      const projectNames = await Promise.all(
        projectCards.map(async (card) => {
          const nameElement = await card.$('h3')
          return nameElement.getText()
        })
      )

      expect(projectNames).toContain('E2E Test Project')
    })
  })
})
