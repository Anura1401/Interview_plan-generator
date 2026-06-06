import { useContext , useEffect} from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, getMe } from "../services/auth.api";

export const useAuth = () => {
    const context = useContext(AuthContext)
    const { user, setuser, loading, setloading } = context

    const handleLogin = async ({ email, password }) => {
        setloading(true)
        try {
            const data = await login({ email, password })

            setuser(data.user)
            return { success: true }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                error: err.response?.data?.message || err.message || "Invalid email or password"
            }
        } finally {
            setloading(false)
        }
    }

    const handleRegister = async ({ username, email, password }) => {
        setloading(true)
        try {
            const data = await register({ username, email, password })

            setuser(data.user)
            return { success: true }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                error: err.response?.data?.message || err.message || "Failed to register"
            }
        } finally {
            setloading(false)
        }
    }

    const handleLogout = async () => {
        setloading(true)
        try {
            const data = await logout()
            setuser(null)
        } catch (err) {

        } finally {
            setloading(false)
        }
    }

    useEffect(() => {
        const getAndSetUser = async () => {
            try {
                const data = await getMe();
                setuser(data.user);
            } catch (error) {
                setuser(null); 
            } finally {
                setloading(false); 
            }
        };

        getAndSetUser();
    }, []);


    return { user, loading, handleRegister, handleLogin, handleLogout }
}