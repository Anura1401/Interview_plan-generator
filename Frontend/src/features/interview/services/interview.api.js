import axios from "axios";

const api = axios.create({
    baseURL: "/",
    withCredentials: true,
})




/**
 * @description Generate new interview report on the basis of user self description,resume pdf and job description
 */
export const generateInterviewReport =  async ({jobDescription,selfDescription,resumeFile}) => {

    const formData = new FormData()
    formData.append("jobDescription",jobDescription)
    formData.append("selfDescription",selfDescription)
    if(resumeFile)
    formData.append("resume",resumeFile)

    const response = await api.post("/api/interview",formData,{
        headers:{
            "Content-Type":"multipart/form-data"
        }
    })
    return response.data
}


/**
 * @description Get interview report by id
 */
export const getInterviewReportById = async (interviewId) => {
    const response = await api.get(`/api/interview/${interviewId}`)

    return response.data
}



/**
 * @description Get all interview reports
 */
export const getAllInterviewReports = async() => {
    const response = await api.get("/api/interview")
    return response.data
}

/**
 * @description Generate resume pdf on the basis of user self description and job description
 */
export const generateResumePDF = async (interviewReportId) => {
    const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`,null,{
        responseType: "blob"
    })
    return response.data
}