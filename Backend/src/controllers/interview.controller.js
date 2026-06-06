const originalWarn = console.warn;
console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('standardFontDataUrl')) return;
    originalWarn(...args);
};

const pdfParse = require('pdf-parse');
const { generateInterviewReport, generateResumePDF } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.models")

async function generateInterviewReportController(req, res) {
    try {
        let resumeContentText = ""
        if (req.file) {
            const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText()
            resumeContentText = resumeContent.text || ""
        }
        const { selfDescription, jobDescription } = req.body

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeContentText,
            selfDescription,
            jobDescription
        })

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeContentText,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        })

        res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })
    } catch (error) {
        console.error("Error generating interview report:", error)
        res.status(500).json({
            message: error.message || "Failed to generate interview report"
        })
    }
}

async function getInterviewReportByIdController(req, res) {
    try {
        const { interviewId } = req.params
        const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({ message: "Interview report not found" })
        }
        res.status(200).json({ message: "Interview report fetched successfully", interviewReport })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

async function getAllInterviewReportsController(req, res) {
    try {
        const interviewReports = await interviewReportModel.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

        res.status(200).json({ message: "Interview reports fetched successfully", interviewReports })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

/**
 * @description This controller generates a PDF version of the resume based on the provided resume text, self-description, and job description. It uses the generateResumePDF function from the AI service to create the PDF content and then sends it back as a downloadable file.
 */
async function generateResumePDFController(req, res) {
    try {
        const { interviewReportId } = req.params

        const interviewReport = await interviewReportModel.findOne({
            _id: interviewReportId,
            user: req.user.id
        })
        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found"
            })
        }
        const { resume, selfDescription, jobDescription } = interviewReport

        const pdfBuffer = await generateResumePDF({ resume, selfDescription, jobDescription })

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })

        res.send(pdfBuffer)
    } catch (error) {
        console.error("Error generating resume PDF:", error)
        res.status(500).json({
            message: error.message || "Failed to generate resume PDF"
        })
    }
}


module.exports = {
    generateInterviewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePDFController
}