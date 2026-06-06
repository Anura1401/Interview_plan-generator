import { createContext,useState } from "react";

export const InterviewContext = createContext()

export const InterviewProvider = ({children}) => {
    const [loading, setloading] = useState(false)
    const [report, setreport] = useState(null)
    const [reports, setreports] = useState([])

    return(
        <InterviewContext.Provider value={{loading,report,setloading,setreport,reports,setreports}}>
        {children}
        </InterviewContext.Provider>
    )
}