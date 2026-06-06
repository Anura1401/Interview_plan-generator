import { getAllInterviewReports, generateInterviewReport, getInterviewReportById, generateResumePDF } from "../services/interview.api"
import { useContext } from "react"
import { InterviewContext } from "../interview.context.jsx"
import { useParams } from "react-router-dom"
import { useEffect } from "react"
import axios from "axios"

export const useInterview = () => {

    const context = useContext(InterviewContext)
    const { interviewId } = useParams()

    if (!context) {
        throw new Error("useInterview must be used within interviewProvider")
    }

    const { loading, setloading, report, setreport, reports, setreports } = context

    const generateReport = async ({ jobDescription, selfDescription, resumeFile }) => {
        setloading(true)
        try {
            const response = await generateInterviewReport({ jobDescription, selfDescription, resumeFile })
            setreport(response.interviewReport)
            return response.interviewReport
        } catch (error) {
            console.log(error)
            throw error
        } finally {
            setloading(false)
        }
    }

    const getReportById = async (interviewId) => {
    setloading(true)
    try {
        const response = await getInterviewReportById(interviewId)
        if (response && response.interviewReport) {
            setreport(response.interviewReport)
        } else {
            console.warn("No report data returned", response)
        }
    } catch (error) {
        console.error("getReportById failed:", error.response?.data || error.message)
    } finally {
        setloading(false)
    }
}

    const getReports = async () => {
        setloading(true)

        try {
            const response = await getAllInterviewReports()
            setreports(response.interviewReports)
        } catch (error) {
            console.log(error)
        } finally {
            setloading(false)
        }
    }

    const getResumePdf = async (interviewReportId) => {
    setloading(true)
    try {
        const blob = await generateResumePDF(interviewReportId)

        const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `resume_${interviewReportId}.pdf`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
    } catch (error) {
        console.log(error)
    } finally {
        setloading(false)
    }
}

        useEffect(() => {
            if (interviewId) {
                getReportById(interviewId)
            }else{
                getReports()
            }
        }, [interviewId])

    return { loading, report, reports, generateReport, getReportById, getReports, getResumePdf }
}