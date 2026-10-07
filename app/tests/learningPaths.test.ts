/**
 * Adresy častí Vzdelávania a vyhradené kľúče (DESIGN_ODCHYLKY R3, 7. 10. 2026).
 */
import { describe, expect, it } from "vitest"
import {
  coursePath, importPath, managePath, NEW_QUESTION_PATH, partPath, questionPath,
  RESERVED_COURSE_KEYS, RESERVED_TEST_KEYS, testsPath,
} from "../src/lib/learningPaths"
import { questionKeyFrom } from "../src/lib/questions"
import { COURSE_KEY } from "../src/lib/courses"
import { createCourse } from "../src/lib/coursesDb"
import { createTest } from "../src/lib/testsDb"

describe("learningPaths", () => {
  it("základná časť je koreň, ostatné vlastný úsek", () => {
    expect(managePath("courses")).toBe("/learning/manage")
    expect(managePath("tags")).toBe("/learning/manage/tags")
    expect(coursePath("bozp")).toBe("/learning/manage/bozp")
    expect(coursePath("bozp", "people")).toBe("/learning/manage/bozp/people")
    expect(partPath("bozp", "uvod")).toBe("/learning/manage/bozp/parts/uvod")
    expect(testsPath("tests")).toBe("/learning/tests")
    expect(testsPath("results")).toBe("/learning/tests/results")
    expect(questionPath("q_1")).toBe("/learning/tests/questions/q_1")
    expect(NEW_QUESTION_PATH).toBe("/learning/tests/questions/new")
    expect(importPath()).toBe("/learning/tests/questions/import")
    expect(importPath("abc")).toBe("/learning/tests/questions/import/abc")
  })

  it("vyhradené slová by inak prešli tvarom kľúča — preto zoznam", () => {
    for (const k of [...RESERVED_COURSE_KEYS, ...RESERVED_TEST_KEYS]) expect(COURSE_KEY.test(k)).toBe(true)
  })

  it("otázka z CSV s ID new/import dostane predponu, stále rovnakú", () => {
    expect(questionKeyFrom("new")).toBe("q_new")
    expect(questionKeyFrom("import")).toBe("q_import")
    expect(questionKeyFrom("vytah_1")).toBe("vytah_1")
  })

  it("kurz ani test s vyhradeným kľúčom nevznikne — skôr než sa siahne do databázy", async () => {
    await expect(createCourse({ companyCode: "SFZ", key: "topics", title: "X", topicKey: "t", topicLabel: "T", language: "sk", actor: "a@b.sk" }))
      .rejects.toMatchObject({ code: "learning.courseKeyReserved" })
    await expect(createTest("SFZ", "Questions", "X", "a@b.sk")).rejects.toMatchObject({ code: "test.keyReserved" })
  })
})
