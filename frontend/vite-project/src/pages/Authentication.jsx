import React, { useContext } from "react";
import {
  Avatar,
  Button,
  TextField,
  Link,
  Grid,
  Box,
  Typography,
  CssBaseline,
  Paper,
  Snackbar,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { AuthContext } from "../context/AuthContext";

const defaultTheme = createTheme();

export default function Authentication() {

  const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [name, setName] = React.useState("");
    const [error, setError] = React.useState("");
    const [message, setMessage] = React.useState("");

    const [formState, setFormState] = React.useState(0);

    const [open, setOpen] = React.useState(false);

    const{handleRegister, handlelogin} = React.useContext(AuthContext);

    let handleAuth = async() => {
      try{

        if(formState === 0 ){
          let result = await handlelogin(username, password);

       }

       if(formState === 1){
        let result = await handleRegister (name, username, password);
        setUsername("")
        setMessage(result);
        setOpen(true);
        setError("")
        setFormState(0)
        setPassword("");

       }

      } 
      catch (err){
        let message = (err.response.data.message);
        setError(message);
          
      }

    }

  return (
    <ThemeProvider theme={defaultTheme}>
      <Grid container component="main" sx={{ height: "100vh", width: "100vw" }} wrap="nowrap">
        <CssBaseline />
        <Grid
         
         sm={4}
         md={7}
         sx={{
          display: { xs: "none", sm: "block" },
         width: "60%",
         height: "100%",
         backgroundImage:
         "url('https://images.unsplash.com/photo-1506744038136-46273834b3fb')",
         backgroundSize: "cover",
         backgroundPosition: "center",
         backgroundRepeat: "no-repeat",
         }}
       />

        <Grid
          
          xs={12}
          sm={8}
          md={5}
          component={Paper}
          elevation={6}
          square
        >
          <Box
            sx={{
              my: 8,
              mx: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}>
              <LockOutlinedIcon />
            </Avatar>
            <div>
              <Button variant={formState === 0 ? "contained" : ""} onClick={() => setFormState(0)} >
                Sign In
              </Button>
              <Button variant={formState === 1 ? "contained" : ""} onClick={() => setFormState(1)}>
                Sign up
              </Button>
            </div>

            <Box component="form" noValidate sx={{ mt: 1 }}>
              {formState === 1 ? <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Full Name"
                name="Full Name"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
              /> : <></>}

              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="username"
                name="username"
                value={username}
                autoFocus
                onChange={(e) => setUsername(e.target.value)}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                id="password"
                label="Password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <p style={{color: "red"}}> {error} </p>
                
              <Button
                type="button"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                onClick={handleAuth}
              >
                {formState === 0 ? "LOGIN" : "REGISTER"} 
              </Button> 

            </Box>
          </Box>
        </Grid>
      
      </Grid>

                     <Snackbar 
                     
                     open={open}
                     autoHideDuration={4000}
                     message={message}

                     />

    </ThemeProvider>
  );
  
}

